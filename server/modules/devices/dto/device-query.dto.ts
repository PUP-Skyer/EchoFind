import { IsOptional, IsString, IsIn, Max, Min } from 'class-validator';

export class DeviceQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['online', 'offline', 'blocked', 'low_battery'])
  status?: 'online' | 'offline' | 'blocked' | 'low_battery';

  @IsOptional()
  @Min(1)
  page?: number;

  @IsOptional()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
