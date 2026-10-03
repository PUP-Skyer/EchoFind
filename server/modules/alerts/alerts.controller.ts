import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertQueryDto } from './dto/alert-query.dto';
import type { Alert, AlertListResponse, OperationLog } from '@shared/api.interface';

@Controller('api/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('logs')
  async getLogs(): Promise<{ logs: OperationLog[]; total: number }> {
    return this.alertsService.getLogs();
  }

  @Get()
  async findAll(@Query() query: AlertQueryDto): Promise<AlertListResponse> {
    const page: number = query.page ? Number(query.page) : 1;
    const pageSize: number = query.pageSize ? Number(query.pageSize) : 20;
    const resolved: boolean | undefined =
      query.resolved !== undefined ? query.resolved === 'true' : undefined;
    return this.alertsService.findAll(query.level, query.type, resolved, page, pageSize);
  }

  @Patch(':id/resolve')
  async resolve(@Param('id') id: string): Promise<Alert> {
    return this.alertsService.resolve(id);
  }
}
