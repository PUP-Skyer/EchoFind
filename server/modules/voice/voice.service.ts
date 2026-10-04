import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const BAIDU_API_KEY = process.env.BAIDU_API_KEY ?? '';
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY ?? '';
const TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const ASR_URL = 'https://vop.baidu.com/server_api';
const TTS_URL = 'https://tsn.baidu.com/text2audio';

interface BaiduToken {
  access_token: string;
  expires_at: number;
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private tokenCache: BaiduToken | null = null;

  constructor(private readonly httpService: HttpService) {}

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expires_at > now + 60000) {
      return this.tokenCache.access_token;
    }

    try {
      const res = await firstValueFrom(
        this.httpService.post(
          TOKEN_URL,
          null,
          {
            params: {
              grant_type: 'client_credentials',
              client_id: BAIDU_API_KEY,
              client_secret: BAIDU_SECRET_KEY,
            },
            timeout: 10000,
          },
        ),
      );
      const data = res.data as { access_token: string; expires_in: number };
      if (!data.access_token) {
        throw new Error('百度 token 响应缺少 access_token');
      }
      this.tokenCache = {
        access_token: data.access_token,
        expires_at: now + data.expires_in * 1000,
      };
      return data.access_token;
    } catch (err: unknown) {
      this.logger.error('获取百度 access_token 失败', err instanceof Error ? err.message : String(err));
      throw new BadRequestException('语音服务暂不可用');
    }
  }

  async speechToText(base64Wav: string, len: number): Promise<string> {
    if (!base64Wav) {
      throw new BadRequestException('音频数据为空');
    }
    const token = await this.getAccessToken();

    try {
      const res = await firstValueFrom(
        this.httpService.post(
          ASR_URL,
          {
            format: 'wav',
            rate: 16000,
            dev_pid: 1537,
            channel: 1,
            token,
            cuid: 'xiaoxun-pet',
            speech: base64Wav,
            len,
          },
          { timeout: 30000 },
        ),
      );
      const data = res.data as { err_no?: number; err_msg?: string; result?: string[] };
      if (data.err_no !== 0) {
        this.logger.error('百度 ASR 错误', data.err_msg ?? `err_no=${data.err_no}`);
        throw new BadRequestException(data.err_msg ?? '语音识别失败');
      }
      return data.result?.[0] ?? '';
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('调用百度 ASR 失败', err instanceof Error ? err.message : String(err));
      throw new BadRequestException('语音识别失败，请重试');
    }
  }

  async textToSpeech(text: string): Promise<Buffer> {
    if (!text || !text.trim()) {
      throw new BadRequestException('文本为空');
    }
    const token = await this.getAccessToken();
    const encodedText = encodeURIComponent(text);

    try {
      const res = await firstValueFrom(
        this.httpService.post(
          TTS_URL,
          `tex=${encodedText}&tok=${token}&cuid=xiaoxun-pet&ctp=1&lan=zh&spd=5&pit=8&vol=15&per=110&aue=9`,
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            responseType: 'arraybuffer',
            timeout: 30000,
          },
        ),
      );
      const contentType = res.headers['content-type'];
      if (contentType && typeof contentType === 'string' && contentType.includes('audio/')) {
        return Buffer.from(res.data as ArrayBuffer);
      }
      const errText = Buffer.from(res.data as ArrayBuffer).toString('utf-8');
      this.logger.error('百度 TTS 返回错误', errText);
      throw new BadRequestException('语音合成失败');
    } catch (err: unknown) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('调用百度 TTS 失败', err instanceof Error ? err.message : String(err));
      throw new BadRequestException('语音合成失败，请重试');
    }
  }
}
