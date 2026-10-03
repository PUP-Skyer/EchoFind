import { IsString, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';
import type { QuickEntrySubmitRequest } from '@shared/api.interface';

export class QuickEntryDto implements QuickEntrySubmitRequest {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  isStored?: boolean;
}
