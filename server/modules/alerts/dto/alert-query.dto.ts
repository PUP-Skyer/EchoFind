import { IsOptional, IsString, IsIn, Max, Min } from 'class-validator';

export class AlertQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['critical', 'warning', 'info'])
  level?: 'critical' | 'warning' | 'info';

  @IsOptional()
  @IsString()
  @IsIn(['blocked', 'low_battery', 'offline', 'abnormal'])
  type?: 'blocked' | 'low_battery' | 'offline' | 'abnormal';

  @IsOptional()
  resolved?: string;

  @IsOptional()
  @Min(1)
  page?: number;

  @IsOptional()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
