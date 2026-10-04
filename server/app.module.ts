import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { ViewModule } from './modules/view/view.module';
import { ItemsModule } from './modules/items/items.module';
import { DevicesModule } from './modules/devices/devices.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { StatsModule } from './modules/stats/stats.module';
import { SettingsModule } from './modules/settings/settings.module';
import { FeishuModule } from './modules/feishu/feishu.module';
import { AIModule } from './modules/ai/ai.module';
import { PetModule } from './modules/pet/pet.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { VoiceModule } from './modules/voice/voice.module';

@Module({
  imports: [
    // 平台 Module，提供平台能力
    PlatformModule.forRoot(),
    // ====== @route-section: business-modules START ======
    // Place all business modules here.Do NOT add fallback modules here.
    ItemsModule,
    DevicesModule,
    AlertsModule,
    StatsModule,
    SettingsModule,
    FeishuModule,
    AIModule,
    PetModule,
    SchedulesModule,
    VoiceModule,
    // ====== @route-section: business-modules END ======

    // ⚠️ @route-order: last
    // ViewModule is the fallback route module, must be registered last.
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
