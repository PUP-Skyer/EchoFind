import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { FeishuModule } from '../feishu/feishu.module';

@Module({
  imports: [FeishuModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
