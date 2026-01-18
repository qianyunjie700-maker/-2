import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// 完全禁用队列功能，避免Redis连接问题导致应用程序崩溃
// 所有队列操作都将返回null或记录警告日志

interface LogisticsJobData {
  orderId: number;
  trackingNumber: string;
  carrierCode: string;
  carrierName: string;
  phone?: string;
}

@Injectable()
export class LogisticsQueue {
  private readonly logger = new Logger(LogisticsQueue.name);
  private readonly queueAvailable = false; // 临时禁用队列功能

  constructor(private readonly configService: ConfigService) {
    this.logger.warn('队列功能已临时禁用，所有物流查询任务将直接处理，不使用队列');
    this.logger.log('当Redis服务可用后，可以重新启用队列功能');
  }

  /**
   * 添加物流查询任务到队列
   */
  async addLogisticsQueryJob(jobData: LogisticsJobData) {
    this.logger.warn('队列功能已禁用，无法添加物流查询任务到队列');
    this.logger.log(`将直接处理物流查询任务: ${jobData.trackingNumber}`);
    return null; // 不使用队列
  }

  /**
   * 获取队列实例（用于worker）
   */
  getQueue(): null {
    return null; // 队列不可用
  }

  /**
   * 检查队列是否可用
   */
  isQueueAvailable(): boolean {
    return this.queueAvailable;
  }
}
