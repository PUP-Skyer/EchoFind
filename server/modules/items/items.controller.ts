import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseBoolPipe,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ItemQueryDto } from './dto/item-query.dto';
import { QuickEntryDto } from './dto/quick-entry.dto';
import type {
  Item,
  ItemListResponse,
  CreateItemRequest,
  UpdateItemRequest,
  QuickEntryListResponse,
  QuickEntrySubmitResponse,
  QuickEntrySubmitRequest,
} from '@shared/api.interface';

@Controller('api/items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  async findAll(@Query() query: ItemQueryDto): Promise<ItemListResponse> {
    const page: number = query.page ? Number(query.page) : 1;
    const pageSize: number = query.pageSize ? Number(query.pageSize) : 20;
    const isStored: boolean | undefined =
      query.isStored !== undefined ? query.isStored === 'true' : undefined;
    return this.itemsService.findAll(query.search, isStored, page, pageSize);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Item> {
    return this.itemsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateItemDto): Promise<Item> {
    const req: CreateItemRequest = {
      id: dto.id,
      name: dto.name,
      signalStrength: dto.signalStrength,
      isStored: dto.isStored,
      imageUrl: dto.imageUrl,
      deviceId: dto.deviceId,
      disposition: dto.disposition,
    };
    return this.itemsService.create(req);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateItemDto): Promise<Item> {
    const req: UpdateItemRequest = {
      name: dto.name,
      signalStrength: dto.signalStrength,
      isStored: dto.isStored,
      imageUrl: dto.imageUrl,
      deviceId: dto.deviceId,
      disposition: dto.disposition,
    };
    return this.itemsService.update(id, req);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.itemsService.remove(id);
  }

  @Get('quick-entry/pending')
  async findPendingEntry(
    @Query('limit') limit?: string,
  ): Promise<QuickEntryListResponse> {
    const pageSize = limit ? Math.min(parseInt(limit, 10), 100) : 20;
    const { items, total } = await this.itemsService.findPendingEntry(pageSize);
    return { items, total };
  }

  @Post('quick-entry/submit')
    async quickEntrySubmit(@Body() dto: QuickEntryDto): Promise<QuickEntrySubmitResponse> {
      const req: QuickEntrySubmitRequest = {
        id: dto.id,
        name: dto.name,
        isStored: dto.isStored,
      };
      const item = await this.itemsService.quickEntry(req.id, req.name, req.isStored ?? false);
      return { success: true, item };
    }

  @Get('disposition/stats')
  async dispositionStats(): Promise<{
    keep: number;
    discard: number;
    recycle: number;
    total: number;
  }> {
    return this.itemsService.dispositionStats();
  }

  @Post('dedup')
  async dedup(): Promise<{
    totalRecords: number;
    uniqueItems: number;
    merged: number;
    deleted: number;
  }> {
    return this.itemsService.dedupBitableRecords();
  }
}
