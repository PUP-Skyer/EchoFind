import { IsString, IsNumber, Min } from 'class-validator';

export class AsrDto {
  @IsString()
  speech!: string;

  @IsNumber()
  @Min(1)
  len!: number;
}
