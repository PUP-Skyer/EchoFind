import { IsOptional, IsString } from 'class-validator';
import type { FeishuConfigUpdate } from '@shared/api.interface';

export class FeishuConfigUpdateDto implements FeishuConfigUpdate {
  @IsOptional()
  @IsString()
  appId?: string;

  @IsOptional()
  @IsString()
  appSecret?: string;

  @IsOptional()
  @IsString()
  appToken?: string;

  @IsOptional()
  @IsString()
  tableId?: string;
}
