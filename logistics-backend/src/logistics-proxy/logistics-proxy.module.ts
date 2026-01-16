import { Module } from '@nestjs/common';
import { LogisticsProxyController } from './logistics-proxy.controller';
import { LogisticsSchedulerService } from './services/logistics-scheduler.service';
import { TrackingNumberRecognitionService } from './services/tracking-number-recognition.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [OrdersModule],
  controllers: [LogisticsProxyController],
  providers: [LogisticsSchedulerService, TrackingNumberRecognitionService],
})
export class LogisticsProxyModule {}
