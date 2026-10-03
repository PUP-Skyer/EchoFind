import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as lark from '@larksuiteoapi/node-sdk';

const FEISHU_APP_ID = process.env.FEISHU_APP_ID ?? '';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET ?? '';
const BITABLE_APP_TOKEN = process.env.BITABLE_APP_TOKEN ?? '';
const BITABLE_TABLE_ID = process.env.BITABLE_TABLE_ID ?? '';

export interface BitableItemFields {
  '编号': string;
  '物品名称': string;
  '强度': number;
  '时间': number;
  '是否存入': number;
  '物品图片'?: Array<{ file_token: string; name: string; type: string; size: number; url?: string }>;
  '贴纸编号'?: string;
  '去向'?: string;
}

@Injectable()
export class FeishuService {
  private readonly logger = new Logger(FeishuService.name);
  private readonly client: lark.Client;
  public readonly appToken = BITABLE_APP_TOKEN;
  public readonly tableId = BITABLE_TABLE_ID;

  constructor() {
    this.client = new lark.Client({
      appId: FEISHU_APP_ID,
      appSecret: FEISHU_APP_SECRET,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    });
  }

  getClient(): lark.Client {
    return this.client;
  }

  getCredentials(): { appId: string; appSecret: string; appToken: string; tableId: string } {
    return {
      appId: FEISHU_APP_ID,
      appSecret: FEISHU_APP_SECRET,
      appToken: BITABLE_APP_TOKEN,
      tableId: BITABLE_TABLE_ID,
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.client.bitable.appTableRecord.list({
        path: {
          app_token: this.appToken,
          table_id: this.tableId,
        },
        params: { page_size: 1 },
      });
      if (res.code !== 0) {
        return { success: false, message: `飞书 API 错误 [${res.code}]: ${res.msg}` };
      }
      return { success: true, message: '连接成功，可正常访问多维表格' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('飞书连接测试失败', msg);
      return { success: false, message: `连接失败: ${msg}` };
    }
  }

  async uploadImage(parentNode: string, file: { name: string; size: number; type: string; buffer: Buffer }): Promise<{ fileToken: string; url?: string }> {
    try {
      const res = (await this.client.drive.media.uploadAll({
        data: {
          file_name: file.name,
          parent_type: 'bitable_file',
          parent_node: parentNode,
          size: file.size,
          file: file.buffer,
        },
      })) as unknown as {
        code: number;
        msg: string;
        data?: { file_token: string; url?: string };
      };
      if (res.code !== 0) {
        throw new BadRequestException(`飞书文件上传失败 [${res.code}]: ${res.msg}`);
      }
      return {
        fileToken: res.data?.file_token ?? '',
        url: res.data?.url,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('飞书文件上传失败', msg);
      throw err;
    }
  }
}
