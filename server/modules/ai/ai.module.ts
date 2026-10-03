import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { ItemsModule } from '../items/items.module';
import { FeishuModule } from '../feishu/feishu.module';
import { SettingsModule } from '../settings/settings.module';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [ItemsModule, FeishuModule, SettingsModule, SchedulesModule, HttpModule],
  controllers: [AIController],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}
