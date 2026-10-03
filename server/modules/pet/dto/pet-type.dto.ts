import { IsString, IsNotEmpty } from 'class-validator';

export class PetTypeDto {
  @IsString()
  @IsNotEmpty()
  petType!: string;
}
