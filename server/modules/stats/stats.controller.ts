import { Controller, Get, Post, Query } from '@nestjs/common';
import { StatsService } from './stats.service';
import type {
  DashboardStats,
  ReportRecord,
  Alert,
  DataFlowStatus,
  TrendDataPoint,
  SignalDistribution,
  StatsOverview,
} from '@shared/api.interface';

@Controller('api/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  async getDashboard(): Promise<DashboardStats> {
    return this.statsService.getDashboard();
  }

  @Get('recent-reports')
  async getRecentReports(@Query('limit') limit?: string): Promise<ReportRecord[]> {
    const limitNum: number = limit ? Number(limit) : 10;
    return this.statsService.getRecentReports(limitNum);
  }

  @Get('recent-alerts')
  async getRecentAlerts(@Query('limit') limit?: string): Promise<Alert[]> {
    const limitNum: number = limit ? Number(limit) : 5;
    return this.statsService.getRecentAlerts(limitNum);
  }

  @Get('dataflow')
  async getDataFlow(): Promise<DataFlowStatus> {
    return this.statsService.getDataFlow();
  }

  @Get('trend')
  async getTrend(@Query('days') days?: string): Promise<TrendDataPoint[]> {
    const daysNum: number = days ? Number(days) : 7;
    return this.statsService.getTrend(daysNum);
  }

  @Get('signal-distribution')
  async getSignalDistribution(): Promise<SignalDistribution[]> {
    return this.statsService.getSignalDistribution();
  }

  @Get('overview')
  async getOverview(): Promise<StatsOverview> {
    return this.statsService.getOverview();
  }
}
