import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { FeishuModule } from '../feishu/feishu.module';

@Module({
  imports: [FeishuModule],
  controllers: [AlertsController],
  providers: [AlertsService],
})
export class AlertsModule {}
