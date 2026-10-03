import { IsOptional, IsString, Max, Min } from 'class-validator';

export class ItemQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  isStored?: string;

  @IsOptional()
  @Min(1)
  page?: number;

  @IsOptional()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
