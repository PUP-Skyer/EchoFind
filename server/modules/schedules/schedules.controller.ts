import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';
import type {
  Schedule,
  ScheduleListResponse,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  ScheduleDayDot,
  ScheduleParseRequest,
  ScheduleParseResponse,
  ScheduleRecommendResponse,
} from '@shared/api.interface';
import { SchedulesService } from './schedules.service';

@Controller('api/schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('day-dots')
  async getDayDots(
    @Query('month') month: string,
  ): Promise<{ dots: ScheduleDayDot[] }> {
    return this.schedulesService.getDayDots(month);
  }

  @Get('recommend')
  @NeedLogin()
  async recommend(
    @Query('date') date: string,
  ): Promise<ScheduleRecommendResponse> {
    return this.schedulesService.recommend(date);
  }

  @Get()
  @NeedLogin()
  async findAll(
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ScheduleListResponse> {
    return this.schedulesService.findAll(date, startDate, endDate);
  }

  @Post('parse')
  @NeedLogin()
  async parse(@Body() dto: ScheduleParseRequest): Promise<ScheduleParseResponse> {
    return this.schedulesService.parse(dto);
  }

  @Post()
  @NeedLogin()
  async create(
    @Req() req: Request,
    @Body() dto: ScheduleCreateRequest,
  ): Promise<Schedule> {
    const { userId } = req.userContext;
    return this.schedulesService.create(dto, userId);
  }

  @Patch(':id')
  @NeedLogin()
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ScheduleUpdateRequest,
  ): Promise<Schedule> {
    const { userId } = req.userContext;
    return this.schedulesService.update(id, dto, userId);
  }

  @Delete(':id')
  @NeedLogin()
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.schedulesService.remove(id);
  }
}
