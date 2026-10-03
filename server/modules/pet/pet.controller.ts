import { Controller, Get, Post, Body, Put } from '@nestjs/common';
import { PetService } from './pet.service';
import { PetTypeDto } from './dto/pet-type.dto';
import { TtsToggleDto } from './dto/tts-toggle.dto';
import type { PetProfile } from '@shared/api.interface';

@Controller('api/pet')
export class PetController {
  constructor(private readonly petService: PetService) {}

  @Get('profile')
  async getProfile(): Promise<PetProfile> {
    return this.petService.getProfile();
  }

  @Put('type')
  async setPetType(@Body() dto: PetTypeDto): Promise<PetProfile> {
    return this.petService.setPetType(dto.petType);
  }

  @Post('feed')
  async feed(): Promise<{ profile: PetProfile; reward: number }> {
    return this.petService.feed();
  }

  @Post('play')
  async play(): Promise<{ profile: PetProfile; reward: number }> {
    return this.petService.play();
  }

  @Put('tts')
  async setTtsEnabled(@Body() dto: TtsToggleDto): Promise<PetProfile> {
    return this.petService.setTtsEnabled(dto.enabled);
  }
}
