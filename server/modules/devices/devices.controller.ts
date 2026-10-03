import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DeviceQueryDto } from './dto/device-query.dto';
import { BindDeviceDto } from './dto/bind-device.dto';
import type { Device, DeviceListResponse, BindDeviceRequest } from '@shared/api.interface';

@Controller('api/devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  async findAll(@Query() query: DeviceQueryDto): Promise<DeviceListResponse> {
    const page: number = query.page ? Number(query.page) : 1;
    const pageSize: number = query.pageSize ? Number(query.pageSize) : 20;
    return this.devicesService.findAll(query.status, page, pageSize);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Device> {
    return this.devicesService.findOne(id);
  }

  @Post('bind')
  async bind(@Body() dto: BindDeviceDto): Promise<Device> {
    const req: BindDeviceRequest = {
      deviceId: dto.deviceId,
      itemId: dto.itemId,
    };
    return this.devicesService.bind(req);
  }

  @Post('unbind/:id')
  async unbind(@Param('id') id: string): Promise<Device> {
    return this.devicesService.unbind(id);
  }
}
