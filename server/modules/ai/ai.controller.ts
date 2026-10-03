import { Controller, Post, Body, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AIService } from './ai.service';
import type {
  AIChatRequest,
  AIChatResponse,
  AIDailyRecommendResponse,
} from '@shared/api.interface';
import { ChatDto } from './dto/chat.dto';

@Controller('api/ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('chat')
  async chat(@Body() dto: ChatDto, @Req() req: Request): Promise<AIChatResponse> {
    const { userId } = req.userContext;
    const request: AIChatRequest = {
      message: dto.message,
      userId,
      history: dto.history,
      temporaryCarryItems: dto.temporaryCarryItems,
    };
    return this.aiService.chat(request);
  }

  @Post('chat-stream')
  async chatStream(@Body() dto: ChatDto, @Req() req: Request, @Res() res: Response): Promise<void> {
    const { userId } = req.userContext;
    const request: AIChatRequest = {
      message: dto.message,
      userId,
      history: dto.history,
      temporaryCarryItems: dto.temporaryCarryItems,
    };

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const stream = this.aiService.chatStream(request);
      for await (const event of stream) {
        if (event.type === 'delta') {
          res.write(`data: ${JSON.stringify({ type: 'delta', content: event.content })}\n\n`);
        } else if (event.type === 'done') {
          res.write(`data: ${JSON.stringify({ type: 'done', data: event.data })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }

  @Get('daily-recommend')
  async dailyRecommend(): Promise<AIDailyRecommendResponse> {
    return this.aiService.dailyRecommend();
  }
}
