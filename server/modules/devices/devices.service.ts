import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Device, DeviceListResponse, BindDeviceRequest } from '@shared/api.interface';

type DeviceStatus = Device['status'];

@Injectable()
export class DevicesService {
  private devices: Device[] = [];

  constructor() {}

  async findAll(
    status?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<DeviceListResponse> {
    let filtered: Device[] = this.devices;
    if (status) {
      filtered = filtered.filter(
        (d: Device) => d.status === status,
      );
    }
    const total: number = filtered.length;
    const start: number = (page - 1) * pageSize;
    const devices: Device[] = filtered.slice(start, start + pageSize);
    return { devices, total };
  }

  async findOne(id: string): Promise<Device> {
    const device: Device | undefined = this.devices.find((d: Device) => d.id === id);
    if (!device) {
      throw new NotFoundException(`设备 ${id} 不存在`);
    }
    return device;
  }

  async bind(dto: BindDeviceRequest): Promise<Device> {
    const { deviceId, itemId } = dto;
    const idx: number = this.devices.findIndex((d: Device) => d.id === deviceId);
    if (idx === -1) {
      throw new NotFoundException(`设备 ${deviceId} 不存在`);
    }
    const itemName: string | null = itemId;
    const updated: Device = {
      ...this.devices[idx],
      boundItemId: itemId,
      boundItemName: itemName,
    };
    this.devices[idx] = updated;
    return updated;
  }

  async unbind(id: string): Promise<Device> {
    const idx: number = this.devices.findIndex((d: Device) => d.id === id);
    if (idx === -1) {
      throw new NotFoundException(`设备 ${id} 不存在`);
    }
    const updated: Device = {
      ...this.devices[idx],
      boundItemId: null,
      boundItemName: null,
    };
    this.devices[idx] = updated;
    return updated;
  }
}
