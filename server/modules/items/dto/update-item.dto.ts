import { IsString, IsOptional, IsNumber, IsBoolean, Max, Min, IsIn } from 'class-validator';
import type { UpdateItemRequest } from '@shared/api.interface';

export class UpdateItemDto implements UpdateItemRequest {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  signalStrength?: number;

  @IsOptional()
  @IsBoolean()
  isStored?: boolean;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['keep', 'discard', 'recycle'])
  disposition?: 'keep' | 'discard' | 'recycle';
}
