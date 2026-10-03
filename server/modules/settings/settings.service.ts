import { Injectable } from '@nestjs/common';
import type {
  FeishuConfig,
  FeishuConfigUpdate,
  ModelConfig,
  ModelConfigUpdate,
  BaseStationConfig,
  BaseStationConfigUpdate,
} from '@shared/api.interface';
import { FeishuService } from '../feishu/feishu.service';

@Injectable()
export class SettingsService {
  constructor(private readonly feishuService: FeishuService) {}

  private modelLastTestTime: string | null = null;
  private modelLastTestSuccess: boolean | null = null;
  private modelBaseUrl = 'https://api.openai-next.com/v1';
  private modelName = 'gpt-4o-mini';
  private modelApiKey = process.env.MODEL_API_KEY ?? '';

  private baseStationLocation = '客厅';
  private baseStationLocationCode = '1';
  private strongSignalThreshold = 70;

  private maskSecret(secret: string): string {
    if (secret.length <= 10) {
      return `${secret.slice(0, 3)}...${secret.slice(-3)}`;
    }
    return `${secret.slice(0, 8)}...${secret.slice(-5)}`;
  }

  async getFeishuConfig(): Promise<FeishuConfig> {
    const cred = this.feishuService.getCredentials();
    return {
      appId: cred.appId,
      appSecretMasked: this.maskSecret(cred.appSecret),
      appToken: cred.appToken,
      tableId: cred.tableId,
      connected: true,
      lastTestTime: new Date().toISOString(),
    };
  }

  async updateFeishuConfig(_dto: FeishuConfigUpdate): Promise<FeishuConfig> {
    return this.getFeishuConfig();
  }

  async testFeishu(): Promise<{ success: boolean; message: string }> {
    return this.feishuService.testConnection();
  }

  getModelConfigRaw(): { baseUrl: string; modelName: string; apiKey: string } {
    return {
      baseUrl: this.modelBaseUrl,
      modelName: this.modelName,
      apiKey: this.modelApiKey,
    };
  }

  async getModelConfig(): Promise<ModelConfig> {
    return {
      baseUrl: this.modelBaseUrl,
      modelName: this.modelName,
      apiKeyMasked: this.maskSecret(this.modelApiKey),
      lastTestTime: this.modelLastTestTime,
      lastTestSuccess: this.modelLastTestSuccess,
    };
  }

  async updateModelConfig(dto: ModelConfigUpdate): Promise<ModelConfig> {
    if (dto.baseUrl) this.modelBaseUrl = dto.baseUrl.replace(/\/$/, '');
    if (dto.modelName) this.modelName = dto.modelName;
    if (dto.apiKey) this.modelApiKey = dto.apiKey;
    return this.getModelConfig();
  }

  async testModelConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.modelBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.modelApiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
          stream: false,
        }),
      });
      this.modelLastTestTime = new Date().toISOString();
      if (!response.ok) {
        const err = await response.text();
        this.modelLastTestSuccess = false;
        return { success: false, message: `连接失败 [${response.status}]: ${err.slice(0, 120)}` };
      }
      this.modelLastTestSuccess = true;
      return { success: true, message: '模型连接正常' };
    } catch (err: unknown) {
      this.modelLastTestTime = new Date().toISOString();
      this.modelLastTestSuccess = false;
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `连接异常: ${msg}` };
    }
  }

  getBaseStationRaw(): { location: string; locationCode: string; threshold: number } {
    return {
      location: this.baseStationLocation,
      locationCode: this.baseStationLocationCode,
      threshold: this.strongSignalThreshold,
    };
  }

  async getBaseStationConfig(): Promise<BaseStationConfig> {
    return {
      location: this.baseStationLocationCode,
      locationName: this.baseStationLocation,
      strongSignalThreshold: this.strongSignalThreshold,
    };
  }

  async updateBaseStationConfig(dto: BaseStationConfigUpdate): Promise<BaseStationConfig> {
    if (dto.location !== undefined) {
      const code = dto.location.trim();
      if (code === '1' || code === '客厅') {
        this.baseStationLocation = '客厅';
        this.baseStationLocationCode = '1';
      } else if (code === '3' || code === '储物柜') {
        this.baseStationLocation = '储物柜';
        this.baseStationLocationCode = '3';
      }
    }
    if (dto.strongSignalThreshold !== undefined) {
      const t = Number(dto.strongSignalThreshold);
      if (!Number.isNaN(t) && t >= 10 && t <= 95) {
        this.strongSignalThreshold = Math.round(t);
      }
    }
    return this.getBaseStationConfig();
  }
}
