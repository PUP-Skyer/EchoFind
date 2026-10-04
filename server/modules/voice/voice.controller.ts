import {
  Controller,
  Post,
  Body,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { VoiceService } from './voice.service';
import { AsrDto } from './dto/asr.dto';

@Controller('api/voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('asr')
  async asr(@Body() dto: AsrDto): Promise<{ text: string }> {
    if (!dto.speech || !dto.len) {
      throw new BadRequestException('缺少音频数据');
    }
    const text = await this.voiceService.speechToText(dto.speech, dto.len);
    return { text };
  }

  @Post('tts')
  async tts(@Body() dto: { text: string }, @Res() res: Response): Promise<void> {
    if (!dto.text || !dto.text.trim()) {
      throw new BadRequestException('文本为空');
    }
    const buffer = await this.voiceService.textToSpeech(dto.text);
    res.setHeader('Content-Type', 'audio/mp3');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(buffer);
  }
}
