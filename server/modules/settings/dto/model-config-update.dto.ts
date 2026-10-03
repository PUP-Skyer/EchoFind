import { IsOptional, IsString, IsUrl } from 'class-validator';
import type { ModelConfigUpdate } from '@shared/api.interface';

export class ModelConfigUpdateDto implements ModelConfigUpdate {
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}
