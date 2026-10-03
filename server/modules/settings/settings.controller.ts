import { Controller, Get, Put, Post, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { FeishuConfigUpdateDto } from './dto/feishu-config-update.dto';
import { ModelConfigUpdateDto } from './dto/model-config-update.dto';
import type {
  FeishuConfig,
  FeishuConfigUpdate,
  ModelConfig,
  ModelConfigUpdate,
  UserProfileInfo,
  BaseStationConfig,
  BaseStationConfigUpdate,
} from '@shared/api.interface';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('feishu')
  async getFeishu(): Promise<FeishuConfig> {
    return this.settingsService.getFeishuConfig();
  }

  @Put('feishu')
  async updateFeishu(@Body() dto: FeishuConfigUpdateDto): Promise<FeishuConfig> {
    const req: FeishuConfigUpdate = {
      appId: dto.appId,
      appSecret: dto.appSecret,
      appToken: dto.appToken,
      tableId: dto.tableId,
    };
    return this.settingsService.updateFeishuConfig(req);
  }

  @Post('feishu/test')
  async testFeishu(): Promise<{ success: boolean; message: string }> {
    return this.settingsService.testFeishu();
  }

  @Get('model')
  async getModelConfig(): Promise<ModelConfig> {
    return this.settingsService.getModelConfig();
  }

  @Put('model')
  async updateModelConfig(@Body() dto: ModelConfigUpdateDto): Promise<ModelConfig> {
    const req: ModelConfigUpdate = {
      baseUrl: dto.baseUrl,
      modelName: dto.modelName,
      apiKey: dto.apiKey,
    };
    return this.settingsService.updateModelConfig(req);
  }

  @Post('model/test')
  async testModel(): Promise<{ success: boolean; message: string }> {
    return this.settingsService.testModelConnection();
  }

  @Get('user-profile')
  async getUserProfile(): Promise<UserProfileInfo> {
    return {
      name: '蒲承玺',
      role: 'EchoFind 使用者 / 参赛队员',
      joinDate: '2026-03-15',
      email: 'puchengxi@echofind.local',
    };
  }

  @Get('base-station')
  async getBaseStation(): Promise<BaseStationConfig> {
    return this.settingsService.getBaseStationConfig();
  }

  @Put('base-station')
  async updateBaseStation(@Body() dto: { location?: string; strongSignalThreshold?: number }): Promise<BaseStationConfig> {
    const req: BaseStationConfigUpdate = {
      location: dto.location,
      strongSignalThreshold: dto.strongSignalThreshold,
    };
    return this.settingsService.updateBaseStationConfig(req);
  }
}
