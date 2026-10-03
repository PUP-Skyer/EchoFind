import { Module } from '@nestjs/common';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { ItemsModule } from '../items/items.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [ItemsModule, SettingsModule],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
