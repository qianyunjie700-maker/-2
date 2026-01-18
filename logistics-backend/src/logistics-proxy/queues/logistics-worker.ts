import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpUtilService } from '../../common/services/http-util.service';
import { LogisticsUtilService } from '../utils/logistics-util.service';
import { OrdersService } from '../../orders/services/orders.service';
import { OrderStatus } from '../../orders/entities/order.entity';
import { LogisticsSelectResponse, LogisticsData } from '../types/logistics-data.interface';

// 导入可选的Worker类型，仅用于类型检查
import type { Worker } from 'bullmq';

interface LogisticsJobData {
  orderId: number;
  trackingNumber: string;
  carrierCode: string;
  carrierName: string;
  phone?: string;
}

@Injectable()
export class LogisticsWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker | null = null;
  private readonly logger = new Logger(LogisticsWorker.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpUtilService: HttpUtilService,
    private readonly logisticsUtilService: LogisticsUtilService,
    private readonly ordersService: OrdersService,
  ) {}

  onModuleInit() {
    // 初始化worker，但不抛出异常
    try {
      this.initWorker();
    } catch (error) {
      this.logger.error(`初始化物流worker失败: ${error.message}`);
      this.logger.warn('物流队列功能将不可用，所有物流查询任务将直接处理');
    }
  }

  onModuleDestroy() {
    // 关闭worker，如果存在的话
    if (this.worker) {
      try {
        this.worker.close();
      } catch (error) {
        this.logger.error(`关闭物流worker失败: ${error.message}`);
      }
    }
  }

  private initWorker() {
    // 完全不初始化worker，避免Redis连接问题导致应用程序崩溃
    this.logger.warn('物流worker已临时禁用，避免Redis连接问题');
    this.logger.log('当Redis服务可用后，可以重新启用物流worker');
    
    // 所有队列功能都已禁用，避免Redis连接问题
    // 当Redis服务可用后，可以取消注释以下代码重新启用队列功能
    
    /*
    try {
      // 动态导入Worker，避免在Redis不可用时导致应用程序崩溃
      const { Worker: WorkerClass } = require('bullmq');
      
      this.worker = new WorkerClass('logistics-queue', async (job) => {
        const { orderId, trackingNumber, carrierCode, carrierName, phone } = job.data as LogisticsJobData;
        
        this.logger.log(`开始处理物流查询任务: 订单ID=${orderId}, 物流单号=${trackingNumber}`);

        try {
          // 构建创建任务参数
          const createParams = {
            ...this.logisticsUtilService.getLogisticsConfig(),
            zffs: 'jinbi', // 支付方式固定为金币
            kdgs: carrierCode,
            kddhs: trackingNumber, // 单个单号也使用批量查询接口
            isBackTaskName: 'yes', // 返回任务名
          };

          // 如果是顺丰快递，需要添加手机尾号（前两位是SF的单号）
          if (carrierCode === 'shunfeng') {
            // 提取手机号的最后四位作为尾号
            const phoneTail = phone ? phone.slice(-4) : '1234'; // 默认尾号
            createParams.kddhs = `${trackingNumber}||${phoneTail}`;
          }

          // 创建查询任务
          const createUrl = `${this.logisticsUtilService.getLogisticsApiBaseUrl()}create/`;
          this.logger.log('创建物流查询任务:', { url: createUrl, params: createParams });
          const createResponse = await this.httpUtilService.httpPost(createUrl, createParams);
          this.logger.log('物流查询任务创建结果:', createResponse);

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
            ...this.logisticsUtilService.getLogisticsConfig(),
            pageno: 1,
            taskname: taskName,
          };

          // 查询物流信息结果的URL
          const selectUrl = `${this.logisticsUtilService.getLogisticsApiBaseUrl()}select/`;

          // 轮询配置
          const maxRetries = 5;
          const retryInterval = 1000; // 1秒

          // 轮询获取结果
          for (let i = 0; i < maxRetries; i++) {
            try {
              this.logger.log('查询物流查询任务结果:', { url: selectUrl, params: selectParams });
              const selectResponse = await this.httpUtilService.httpPost(selectUrl, selectParams);
              this.logger.log('物流查询任务结果:', selectResponse);

              // 检查查询结果响应
              let parsedSelectResponse;
              try {
                parsedSelectResponse = typeof selectResponse === 'string' ? JSON.parse(selectResponse) : selectResponse;
              } catch (error) {
                throw new Error('无法解析物流API查询结果响应');
              }

              if (parsedSelectResponse.code === 1) {
                // 任务已完成，更新订单状态
                await this.updateOrderWithLogisticsData(orderId, parsedSelectResponse);
                return { success: true, taskName, data: parsedSelectResponse };
              } else if (parsedSelectResponse.code === 2) {
                // 任务处理中，继续轮询
                this.logger.log(`物流查询任务处理中，等待 ${retryInterval}ms 后重试...`);
                await new Promise(resolve => setTimeout(resolve, retryInterval));
              } else {
                // 任务失败
                throw new Error(`物流查询任务失败: ${parsedSelectResponse.msg || '未知错误'}`);
              }
            } catch (error) {
              // 如果是网络错误，继续重试
              this.logger.error(`查询物流查询任务结果失败: ${error.message}`);
              if (i < maxRetries - 1) {
                this.logger.log(`等待 ${retryInterval}ms 后重试...`);
                await new Promise(resolve => setTimeout(resolve, retryInterval));
              } else {
                throw error;
              }
            }
          }

          throw new Error('物流查询任务超时');
        } catch (error) {
          this.logger.error(`处理物流查询任务失败: ${error.message}`);
          // 更新订单状态为查询失败
          await this.ordersService.update(orderId, {
            status: OrderStatus.FAILED,
            details: {
              logisticsQueryFailed: true,
              logisticsQueryErrorMessage: error.message,
            },
          });
          throw error;
        }
      }, {
        connection: {
          host: this.configService.get('REDIS_HOST') || 'localhost',
          port: parseInt(this.configService.get('REDIS_PORT') || '6379'),
          // 如果有密码和数据库配置，可以在这里添加
          // password: this.configService.get('REDIS_PASSWORD'),
          // db: parseInt(this.configService.get('REDIS_DB') || '0'),
        },
      });
    } catch (error) {
      this.logger.error(`初始化物流worker失败: ${error.message}`);
      this.logger.warn('物流队列功能将不可用，所有物流查询任务将直接处理');
    }
    */
  }
  
  /**
   * 更新订单的物流信息
   */
  private async updateOrderWithLogisticsData(orderId: number, logisticsData: LogisticsSelectResponse) {
    // 确保这是一个有效的方法，即使没有实际的worker实现
    this.logger.log(`更新订单物流信息: 订单ID=${orderId}`);
    // 暂时不实现实际的更新逻辑，因为worker已经被禁用
  }
}
