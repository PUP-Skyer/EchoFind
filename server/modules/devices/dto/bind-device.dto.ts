import { IsString } from 'class-validator';
import type { BindDeviceRequest } from '@shared/api.interface';

export class BindDeviceDto implements BindDeviceRequest {
  @IsString()
  deviceId!: string;

  @IsString()
  itemId!: string;
}
