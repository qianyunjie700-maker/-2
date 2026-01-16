import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import * as http from 'http';
import * as querystring from 'querystring';
import { TrackingNumberRecognitionService } from './services/tracking-number-recognition.service';
import { OrdersService } from '../orders/services/orders.service';
import { OrderStatus } from '../orders/entities/order.entity';
import { LogisticsSelectResponse, LogisticsData } from './types/logistics-data.interface';

@Controller('logistics-proxy')
export class LogisticsProxyController {
  // 物流API基础URL
  private readonly logisticsApiBaseUrl = 'http://yun.zhuzhufanli.com/mini/';

  // 物流API配置
  private readonly logisticsConfig = {
    appid: 346462,
    outerid: '5DAD3AA8098741C0',
  };

  constructor(
    private readonly trackingNumberRecognitionService: TrackingNumberRecognitionService,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * 使用Node.js内置http模块发送POST请求
   */
  private async httpPost(url: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // 解析URL
      const urlParts = new URL(url);

      // 构建请求参数
      const postData = querystring.stringify(data);

      // 请求选项
      const options = {
        hostname: urlParts.hostname,
        port: urlParts.port || 80,
        path: urlParts.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      // 发送请求
      const req = http.request(options, (res) => {
        let responseData = '';

        // 接收响应数据
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        // 响应结束
        res.on('end', () => {
          try {
            // 尝试解析JSON响应
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (error) {
            // 如果不是JSON格式，直接返回原始数据
            resolve(responseData);
          }
        });
      });

      // 处理请求错误
      req.on('error', (error) => {
        reject(error);
      });

      // 发送请求数据
      req.write(postData);
      req.end();
    });
  }



  /**
   * 查询单个物流单号的信息并同步到数据库
   */
  @Post('query-and-sync')
  async queryAndSyncLogistics(@Body() requestData: any) {
    try {
      const { kddh, kdgs, customer_name = '未知客户', department_key = 'EAST', phone = '' } = requestData;

      if (!kddh) {
        throw new HttpException('物流单号不能为空', HttpStatus.BAD_REQUEST);
      }

      // 如果没有提供快递公司代码，尝试识别
      let carrierCode = kdgs;
      let carrierName = '';

      if (!carrierCode) {
        const recognitionResult = await this.trackingNumberRecognitionService.recognizeTrackingNumber(kddh);
        carrierCode = recognitionResult.carrierCode;
        carrierName = recognitionResult.carrierName;
      } else {
        // 根据快递公司代码获取名称
        const carrierMap: Record<string, string> = {
          'yuantong': '圆通速递',
          'jingdong': '京东物流',
          'kuayuesuyun': '跨越速运',
          'shentong': '申通快递',
          'zhongtong': '中通快递',
          'shunfeng': '顺丰速运',
        };
        carrierName = carrierMap[carrierCode] || carrierCode;
      }

      if (!carrierCode) {
        throw new HttpException('无法识别该物流单号的快递公司', HttpStatus.BAD_REQUEST);
      }

      // 查找或创建订单（无论物流查询是否成功，都需要先创建订单）
      let order: any = null;
      try {
        // 尝试根据物流单号查找订单
        const orders = await this.ordersService.getOrders({ order_number: kddh });
        if (orders && orders.length > 0) {
          order = orders[0];
        }
      } catch (error) {
        console.log('未找到现有订单，将创建新订单');
      }

      if (!order) {
        // 创建新订单
        order = await this.ordersService.createOrder({
          order_number: kddh,
          customer_name: customer_name,
          department_key: department_key,
          carrier: carrierName,
          status: OrderStatus.PENDING,
          warning_status: 'none',
          is_archived: false,
          details: {
            logisticsQueryFailed: true,
            logisticsQueryErrorMessage: '',
          },
        });
      }

      // 尝试调用第三方物流API查询物流信息
      let logisticsInfo: LogisticsData | null = null;
      let logisticsQueryError = null;

      try {
        // 构建创建任务参数
        const createParams = {
          ...this.logisticsConfig,
          zffs: 'jinbi', // 支付方式固定为金币
          kdgs: carrierCode,
          kddhs: kddh, // 单个单号也使用批量查询接口
          isBackTaskName: 'yes', // 返回任务名
        };

        // 如果是顺丰快递，需要添加手机尾号（前两位是SF的单号）
        if (carrierCode === 'shunfeng') {
          // 提取手机号的最后四位作为尾号
          const phoneTail = phone ? phone.slice(-4) : '1234'; // 默认尾号
          createParams.kddhs = `${kddh}||${phoneTail}`;
        }

        // 创建查询任务
        const createUrl = `${this.logisticsApiBaseUrl}create/`;
        console.log('创建物流查询任务:', { url: createUrl, params: createParams });
        const createResponse = await this.httpPost(createUrl, createParams);
        console.log('物流查询任务创建结果:', createResponse);

        // 检查创建任务响应
        let parsedCreateResponse;
        try {
          parsedCreateResponse = typeof createResponse === 'string' ? JSON.parse(createResponse) : createResponse;
        } catch (error) {
          throw new Error('无法解析物流API创建任务响应');
        }

        if (parsedCreateResponse.code !== 1) {
          throw new Error(`创建物流查询任务失败: ${parsedCreateResponse.msg || '未知错误'}`);
        }

        const taskName = parsedCreateResponse.msg;
        if (!taskName) {
          throw new Error('创建物流查询任务失败，未返回任务名');
        }

        // 等待一段时间，让系统处理任务
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 构建查询结果参数
        const selectParams = {
          ...this.logisticsConfig,
          pageno: 1,
          taskname: taskName,
        };

        // 查询物流信息结果
        const selectUrl = `${this.logisticsApiBaseUrl}select/`;
        console.log('查询物流信息结果:', { url: selectUrl, params: selectParams });
        const selectResponse = await this.httpPost(selectUrl, selectParams);
        console.log('物流信息查询结果:', selectResponse);

        // 检查查询结果响应
        let parsedSelectResponse: LogisticsSelectResponse;
        try {
          parsedSelectResponse = typeof selectResponse === 'string' ? JSON.parse(selectResponse) : selectResponse;
        } catch (error) {
          throw new Error('无法解析物流API查询结果响应');
        }

        if (parsedSelectResponse.code !== 1) {
          throw new Error(`查询物流信息结果失败: ${parsedSelectResponse.msg || '未知错误'}`);
        }

        // 检查任务是否完成
        if (parsedSelectResponse.msg.jindu !== 100) {
          throw new Error('物流查询任务尚未完成，请稍后再试');
        }

        // 获取物流信息
        logisticsInfo = parsedSelectResponse.msg.list?.[0];
        if (!logisticsInfo) {
          throw new Error('未找到物流信息');
        }

        // 更新订单的物流信息
        await this.ordersService.updateOrderStatus(order.id, {
          status: this.mapLogisticsStatus(logisticsInfo.wuliuzhuangtai),
          warning_status: logisticsInfo.wuliuzhuangtai.includes('异常') ? 'warning' : 'none',
          details: {
            trackingInfo: logisticsInfo,
            trackingNodes: this.parseTrackingDetails(logisticsInfo.xiangxiwuliu || ''),
            lastTrackingUpdate: new Date().toISOString(),
            logisticsQueryFailed: false,
            logisticsQueryErrorMessage: '',
          },
        });

        // 返回更新后的订单信息
        const updatedOrder = await this.ordersService.getOrderById(order.id);

        return {
          code: 0,
          msg: {
            order: updatedOrder,
            logisticsInfo: logisticsInfo,
            logisticsQuerySuccess: true,
          },
        };
      } catch (error) {
        // 物流查询失败，记录错误信息但仍返回订单信息
        const errorMessage = (error as Error).message;
        console.error('查询物流信息失败:', errorMessage);
        
        // 更新订单的错误信息
        await this.ordersService.updateOrderStatus(order.id, {
          status: OrderStatus.PENDING,
          warning_status: 'none',
          details: {
            logisticsQueryFailed: true,
            logisticsQueryErrorMessage: errorMessage,
            lastTrackingUpdate: new Date().toISOString(),
          },
        });

        // 返回订单信息和物流查询失败的错误信息
        const updatedOrder = await this.ordersService.getOrderById(order.id);

        return {
          code: 0,
          msg: {
            order: updatedOrder,
            logisticsInfo: null,
            logisticsQuerySuccess: false,
            logisticsQueryError: errorMessage,
          },
        };
      }
    } catch (error) {
      console.error('查询并同步物流信息失败:', error);
      throw new HttpException(
        '查询并同步物流信息失败: ' + (error as Error).message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 将第三方物流API的状态映射到系统内部状态
   */
  private mapLogisticsStatus(logisticsStatus: string): OrderStatus {
    const normalizedStatus = logisticsStatus.toLowerCase();
    
    if (normalizedStatus.includes('已签收') || normalizedStatus.includes('签收') || normalizedStatus.includes('已代收')) {
      return OrderStatus.DELIVERED;
    } else if (normalizedStatus.includes('已退回') || normalizedStatus.includes('退回')) {
      return OrderStatus.RETURNED;
    } else if (normalizedStatus.includes('运输中') || normalizedStatus.includes('运输') || 
               normalizedStatus.includes('派件') || normalizedStatus.includes('派送') || 
               normalizedStatus.includes('揽收') || normalizedStatus.includes('已揽收') || 
               normalizedStatus.includes('已发出') || normalizedStatus.includes('发出') ||
               normalizedStatus.includes('已到达') || normalizedStatus.includes('到达') ||
               normalizedStatus.includes('正在派送')) {
      return OrderStatus.IN_TRANSIT;
    } else if (normalizedStatus.includes('无物流') || normalizedStatus.includes('待查询')) {
      return OrderStatus.PENDING;
    }
    
    console.warn(`未知的物流状态: ${logisticsStatus}`);
    return OrderStatus.IN_TRANSIT;
  }

  /**
   * 解析详细物流信息
   */
  private parseTrackingDetails(details: string): any[] {
    if (!details || details === '//太长省略//') {
      return [];
    }
    
    try {
      // 尝试解析为JSON
      const parsed = JSON.parse(details);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      // 如果不是JSON格式，尝试按照格式解析
      const nodes: any[] = [];
      
      // 假设格式为：时间|描述
      const lines = details.split('\n');
      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 2) {
          nodes.push({
            time: parts[0].trim(),
            description: parts.slice(1).join('|').trim(),
          });
        }
      }
      
      return nodes;
    }
    
    return [];
  }
}
