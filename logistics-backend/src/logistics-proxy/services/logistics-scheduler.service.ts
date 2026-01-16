import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OrdersService } from '../../orders/services/orders.service';
import * as querystring from 'querystring';
import * as http from 'http';

@Injectable()
export class LogisticsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(LogisticsSchedulerService.name);
  private readonly logisticsApiBaseUrl = 'http://yun.zhuzhufanli.com/mini/';
  private readonly logisticsConfig = {
    appid: 346462,
    outerid: '5DAD3AA8098741C0',
  };

  constructor(
    private readonly ordersService: OrdersService,
  ) {}

  // 模块初始化时启动定时任务
  onModuleInit() {
    this.scheduleDailyUpdate();
  }

  // 调度每天凌晨12点执行的任务
  private scheduleDailyUpdate() {
    this.logger.log('初始化物流信息每日更新任务...');
    
    // 立即执行一次更新
    this.updateAllLogisticsInfo();
    
    // 计算当前时间到明天凌晨12点的时间差
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const delay = tomorrow.getTime() - now.getTime();
    
    // 设置定时器，明天凌晨12点执行任务
    setTimeout(() => {
      // 执行更新任务
      this.updateAllLogisticsInfo();
      
      // 设置每天重复执行的定时器
      setInterval(() => {
        this.updateAllLogisticsInfo();
      }, 24 * 60 * 60 * 1000); // 24小时
    }, delay);
  }

  // 更新所有订单的物流信息
  private async updateAllLogisticsInfo() {
    try {
      this.logger.log('开始更新所有订单的物流信息...');
      
      // 获取所有未归档的订单
      const { orders } = await this.ordersService.getOrders({ is_archived: false });
      
      if (orders.length === 0) {
        this.logger.log('没有需要更新物流信息的订单');
        return;
      }
      
      this.logger.log(`找到 ${orders.length} 个订单需要更新物流信息`);
      
      // 批量获取物流信息
      const logisticsData = await this.fetchBulkLogisticsInfo(orders);
      
      // 更新订单的物流状态
      await this.updateOrdersWithLogisticsData(orders, logisticsData);
      
      this.logger.log('物流信息更新完成');
    } catch (error) {
      this.logger.error('更新物流信息失败:', error);
    }
  }

  // 批量获取物流信息
  private async fetchBulkLogisticsInfo(orders: any[]): Promise<any[]> {
    const allLogisticsData: any[] = [];
    
    // 根据订单的承运商分组，同一承运商的订单一起处理
    const ordersByCarrier = orders.reduce((groups, order) => {
      if (!order.carrier || !order.order_number) {
        this.logger.warn(`订单 ${order.id} 缺少物流单号或承运商信息，跳过查询`);
        return groups;
      }
      
      const carrier = this.getCarrierCode(order.carrier);
      if (!groups[carrier]) {
        groups[carrier] = [];
      }
      groups[carrier].push(order);
      return groups;
    }, {} as Record<string, any[]>);
    
    // 为每个承运商的订单创建批量查询任务
    for (const [carrier, carrierOrders] of Object.entries(ordersByCarrier) as [string, any[]][]) {
      try {
        // 分批处理订单，每次最多处理50个订单
        const batchSize = 50;
        for (let i = 0; i < carrierOrders.length; i += batchSize) {
          const batch = carrierOrders.slice(i, i + batchSize);
          
          // 构建批量查询参数
          const kddhs = batch.map(order => order.order_number).join(',');
          
          // 构建创建任务参数
          const createParams = {
            ...this.logisticsConfig,
            zffs: 'jinbi', // 支付方式固定为金币
            kdgs: carrier,
            kddhs: kddhs,
            isBackTaskName: 'yes', // 返回任务名
          };
          
          // 创建查询任务
          const createResponse = await this.httpPost(`${this.logisticsApiBaseUrl}create/`, createParams);
          
          // 检查创建任务响应
          if (createResponse.code !== 1) {
            this.logger.error(`创建物流查询任务失败: ${createResponse.msg}`);
            continue;
          }
          
          const taskName = createResponse.msg;
          if (!taskName) {
            this.logger.error('创建物流查询任务失败，未返回任务名');
            continue;
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
          const selectResponse = await this.httpPost(`${this.logisticsApiBaseUrl}select/`, selectParams);
          
          // 检查查询结果响应
          if (selectResponse.code !== 1) {
            this.logger.error(`查询物流信息结果失败: ${selectResponse.msg}`);
            continue;
          }
          
          // 检查任务是否完成
          if (selectResponse.msg.jindu !== 100) {
            this.logger.error('物流查询任务尚未完成');
            continue;
          }
          
          // 处理物流信息
          const logisticsList = selectResponse.msg.list || [];
          allLogisticsData.push(...logisticsList);
        }
      } catch (error) {
        this.logger.error(`处理承运商 ${carrier} 的订单时出错:`, error);
      }
    }
    
    return allLogisticsData;
  }
  
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
   * 更新订单的物流状态
   */
  private async updateOrdersWithLogisticsData(orders: any[], logisticsData: any[]) {
    for (const order of orders) {
      try {
        // 查找对应的物流信息
        const logisticsInfo = logisticsData.find(item => item.wuliudanhao === order.order_number);
        if (!logisticsInfo) {
          this.logger.warn(`未找到订单 ${order.id} 的物流信息`);
          continue;
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
        
        this.logger.log(`更新订单 ${order.id} 的物流信息成功`);
      } catch (error) {
        this.logger.error(`更新订单 ${order.id} 的物流信息失败:`, error);
      }
    }
  }
  
  /**
   * 将物流状态映射到订单状态
   */
  private mapLogisticsStatus(logisticsStatus: string): string {
    if (logisticsStatus.includes('已签收') || logisticsStatus.includes('已完成')) {
      return 'delivered';
    } else if (logisticsStatus.includes('运输中') || logisticsStatus.includes('派送中')) {
      return 'in_transit';
    } else if (logisticsStatus.includes('异常')) {
      return 'exception';
    } else {
      return 'pending';
    }
  }
  
  /**
   * 解析物流详情
   */
  private parseTrackingDetails(details: string): any[] {
    try {
      return JSON.parse(details);
    } catch (error) {
      return [];
    }
  }
  
  /**
   * 获取承运商代码
   */
  private getCarrierCode(carrierName: string): string {
    const carrierMap: Record<string, string> = {
      '圆通速递': 'yuantong',
      '京东物流': 'jingdong',
      '跨越速运': 'kuayuesuyun',
      '申通快递': 'shentong',
      '中通快递': 'zhongtong',
      '顺丰速运': 'shunfeng',
    };
    
    return carrierMap[carrierName] || carrierName;
  }
}