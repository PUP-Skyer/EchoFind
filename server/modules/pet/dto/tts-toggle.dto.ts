import { IsBoolean } from 'class-validator';

export class TtsToggleDto {
  @IsBoolean()
  enabled!: boolean;
}
