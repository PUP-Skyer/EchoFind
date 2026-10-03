import { IsString, IsNotEmpty, IsArray, IsOptional, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import type { AIChatRequest } from '@shared/api.interface';

class HistoryItemDto {
  @IsString()
  @IsNotEmpty()
  role!: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class ChatDto implements AIChatRequest {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoryItemDto)
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;

  @IsOptional()
  @IsObject()
  context?: {
    items?: Array<{ id: string; name: string; isStored: boolean; signalStrength: number }>;
    weather?: string;
    schedule?: string;
  };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  temporaryCarryItems?: string[];
}
