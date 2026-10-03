import { useEffect, useCallback, useState } from 'react';
import { Calendar, Mail, Star, User } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { echofind } from '@client/src/api';
import type { UserProfileInfo } from '@shared/api.interface';
import { Badge } from '@client/src/components/ui/badge';
import { Card, CardContent } from '@client/src/components/ui/card';

const UserProfilePage: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async (): Promise<void> => {
    try {
      const data = await echofind.settings.getUserProfile();
      setUserProfile(data);
    } catch (err: unknown) {
      logger.error('获取用户信息失败', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUserProfile();
  }, [fetchUserProfile]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#2D3436]">用户信息</h1>
        <p className="text-sm text-[#636E72] mt-1">查看与管理你的个人资料</p>
      </div>

      <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-[#6C5CE7]/20">
              {loading ? '?' : userProfile?.name?.slice(0, 1) ?? '?'}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-[#2D3436]">
                {loading ? '加载中...' : userProfile?.name}
              </h3>
              <Badge
                variant="outline"
                className="mt-2 border-[#6C5CE7]/20 bg-[#6C5CE7]/5 text-[#6C5CE7] shadow-none"
              >
                <Star className="h-3 w-3 mr-1" />
                {userProfile?.role}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-[#DFE6E9]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#6C5CE7]/10 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-[#6C5CE7]" />
              </div>
              <div>
                <div className="text-xs text-[#B2BEC3]">加入时间</div>
                <div className="text-sm font-medium text-[#2D3436] mt-0.5">
                  {userProfile?.joinDate}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#6C5CE7]/10 flex items-center justify-center">
                <Mail className="h-4 w-4 text-[#6C5CE7]" />
              </div>
              <div>
                <div className="text-xs text-[#B2BEC3]">联系邮箱</div>
                <div className="text-sm font-medium text-[#2D3436] mt-0.5 break-all">
                  {userProfile?.email}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
        <h3 className="text-base font-semibold text-[#2D3436] mb-3">
          <User className="inline-block h-4 w-4 mr-1.5 text-[#6C5CE7]" />
          关于 EchoFind
        </h3>
        <p className="text-sm text-[#636E72] leading-relaxed">
          EchoFind 是基于 ESP32 贴纸 + 飞书多维表格的智能寻物系统，
          通过无线电信号定位物品位置，配合 AI 助手小寻实现自然语言找物。
        </p>
      </div>
    </div>
  );
};

export default UserProfilePage;
