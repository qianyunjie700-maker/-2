import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LogisticsQueue } from './logistics-queue';
import { LogisticsWorker } from './logistics-worker';
import { HttpUtilModule } from '../../common/http-util.module';
import { LogisticsUtilService } from '../utils/logistics-util.service';
import { OrdersService } from '../../orders/services/orders.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../orders/entities/order.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Order]),
    HttpUtilModule,
  ],
  providers: [
    LogisticsQueue,
    LogisticsWorker,
    LogisticsUtilService,
    OrdersService,
  ],
  exports: [LogisticsQueue],
})
export class LogisticsQueueModule {}
