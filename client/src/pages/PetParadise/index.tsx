import { useEffect, useCallback, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Cookie,
  Gamepad2,
  Heart,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { echofind } from '@client/src/api';
import type { PetProfile } from '@shared/api.interface';
import { Button } from '@client/src/components/ui/button';
import { Switch } from '@client/src/components/ui/switch';
import { Badge } from '@client/src/components/ui/badge';
import { Card, CardHeader, CardContent } from '@client/src/components/ui/card';
import { PET_INFO, PET_NAME_MAP } from '@client/src/components/xiaoxun/petData';
import PetAvatar from '@client/src/components/xiaoxun/PetAvatar';
import type { PetType } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';
import { toast } from 'sonner';

const MOOD_LABELS: Record<string, string> = {
  happy: '开心',
  normal: '普通',
  sad: '闷闷不乐',
};

function formatTime(iso: string | null): string {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    const pad = (n: number): string => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  } catch {
    return iso;
  }
}

const PetParadisePage: React.FC = () => {
  const [petProfile, setPetProfile] = useState<PetProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [petActionLoading, setPetActionLoading] = useState<string | null>(null);
  const [rewardToast, setRewardToast] = useState<number | null>(null);

  const fetchPetProfile = useCallback(async (): Promise<void> => {
    try {
      const data = await echofind.pet.getProfile();
      setPetProfile(data);
    } catch (err: unknown) {
      logger.error('获取宠物资料失败', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPetProfile();
  }, [fetchPetProfile]);

  const handleSwitchPet = async (petType: string): Promise<void> => {
    try {
      const res = await echofind.pet.setPetType(petType);
      setPetProfile(res);
      const event = new CustomEvent('echofind-pet-type-changed', {
        detail: { petType: res.petType },
      });
      window.dispatchEvent(event);
      toast('已切换宠物形象');
    } catch (err: unknown) {
      logger.error('切换宠物失败', err);
      toast.error('切换失败，请重试');
    }
  };

  const handleFeed = async (): Promise<void> => {
    setPetActionLoading('feed');
    try {
      const res = await echofind.pet.feed();
      setPetProfile(res.profile);
      if (res.reward > 0) {
        setRewardToast(res.reward);
        setTimeout(() => setRewardToast(null), 1500);
      }
    } catch (err: unknown) {
      logger.error('喂食失败', err);
    } finally {
      setPetActionLoading(null);
    }
  };

  const handlePlay = async (): Promise<void> => {
    setPetActionLoading('play');
    try {
      const res = await echofind.pet.play();
      setPetProfile(res.profile);
      if (res.reward > 0) {
        setRewardToast(res.reward);
        setTimeout(() => setRewardToast(null), 1500);
      }
    } catch (err: unknown) {
      logger.error('玩耍失败', err);
    } finally {
      setPetActionLoading(null);
    }
  };

  const handleToggleTts = async (enabled: boolean): Promise<void> => {
    try {
      const res = await echofind.pet.setTtsEnabled(enabled);
      setPetProfile(res);
    } catch (err: unknown) {
      logger.error('切换 TTS 失败', err);
    }
  };

  const level = petProfile?.level ?? 1;
  const intimacy = petProfile?.intimacy ?? 0;
  const nextLevel = petProfile?.nextLevelIntimacy ?? 50;
  const progress = Math.min(
    100,
    Math.round(
      ((intimacy - (level > 1 ? 50 : 0)) / Math.max(1, nextLevel - (level > 1 ? 50 : 0))) * 100,
    ),
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#2D3436]">桌宠乐园</h1>
        <p className="text-sm text-[#636E72] mt-1">
          陪伴你的小寻，喂食玩耍提升亲密度
        </p>
      </div>

      <Card className="rounded-2xl border-0 shadow-[0_2px_12px_rgba(0_0_0_0.03)] overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center relative">
            {rewardToast !== null && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 animate-bounce">
                <Badge className="bg-[#FDCB6E] text-white border-0 shadow-lg shadow-[#FDCB6E]/30">
                  +{rewardToast} 亲密度
                </Badge>
              </div>
            )}
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#FDCB6E]/20 to-[#6C5CE7]/20 flex items-center justify-center mb-4 shadow-inner overflow-hidden">
              {!loading && petProfile ? (
                <PetAvatar
                  petType={(petProfile.petType as PetType) ?? 'cyan_dragon'}
                  size={96}
                  mood="happy"
                />
              ) : (
                <span className="text-4xl">🐾</span>
              )}
            </div>
            <h3 className="text-xl font-bold text-[#2D3436]">
              {loading
                ? '加载中...'
                : PET_NAME_MAP[petProfile?.petType as PetType] ?? '小寻'}
            </h3>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant="outline"
                className="border-[#6C5CE7]/20 bg-[#6C5CE7]/5 text-[#6C5CE7] shadow-none"
              >
                Lv.{level}
              </Badge>
              <Badge
                variant="outline"
                className="border-[#FDCB6E]/30 bg-[#FDCB6E]/10 text-[#F39C12] shadow-none"
              >
                {petProfile ? MOOD_LABELS[petProfile.mood] ?? '普通' : '普通'}
              </Badge>
            </div>

            <div className="w-full mt-5">
              <div className="flex items-center justify-between text-xs text-[#636E72] mb-1.5">
                <span className="flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5 text-[#E17055]" />
                  亲密度 {intimacy}
                </span>
                <span>下一等级 {nextLevel}</span>
              </div>
              <div className="w-full h-2 bg-[#F5F6FA] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-5 w-full">
              <Button
                onClick={(): Promise<void> => handleFeed()}
                disabled={petActionLoading === 'feed' || loading}
                className="bg-[#FDCB6E] hover:bg-[#F39C12] text-white flex-1"
              >
                <Cookie className="h-4 w-4 mr-1.5" />
                喂食 +10
              </Button>
              <Button
                onClick={(): Promise<void> => handlePlay()}
                disabled={petActionLoading === 'play' || loading}
                className="bg-[#6C5CE7] hover:bg-[#5B4CDB] text-white flex-1"
              >
                <Gamepad2 className="h-4 w-4 mr-1.5" />
                玩耍 +15
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-5 rounded-2xl border-0 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-[#6C5CE7]" />
            <h3 className="text-base font-semibold text-[#2D3436]">语音播报</h3>
          </div>
          <p className="text-xs text-[#636E72] mt-1">小寻回复时是否使用 TTS 语音播报</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {petProfile?.ttsEnabled ? (
                <Volume2 className="h-5 w-5 text-[#6C5CE7]" />
              ) : (
                <VolumeX className="h-5 w-5 text-[#B2BEC3]" />
              )}
              <div>
                <div className="text-sm font-medium text-[#2D3436]">TTS 语音播报</div>
                <div className="text-xs text-[#B2BEC3] mt-0.5">
                  {petProfile?.ttsEnabled ? '小寻会把回复读出来' : '仅文字回复'}
                </div>
              </div>
            </div>
            <Switch
              checked={petProfile?.ttsEnabled ?? false}
              onCheckedChange={(checked: boolean): void => {
                void handleToggleTts(checked);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-5 rounded-2xl border-0 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
        <CardHeader className="pb-0">
          <h3 className="text-base font-semibold text-[#2D3436]">选择桌宠形象</h3>
          <p className="text-xs text-[#636E72] mt-1">切换后右下角悬浮宠物同步更换</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
            {PET_INFO.map((pet) => {
              const isActive = petProfile?.petType === pet.type;
              return (
                <button
                  key={pet.type}
                  onClick={(): Promise<void> => handleSwitchPet(pet.type)}
                  className={`group relative flex flex-col items-center gap-2 py-3 px-2 rounded-2xl border-2 transition-all duration-200 hover:scale-105 ${
                    isActive
                      ? 'border-[#6C5CE7] bg-transparent shadow-[0_0_0_4px_rgba(108_92_231_0.2)] scale-105'
                      : 'border-transparent bg-transparent hover:border-[#A29BFE]/40 hover:shadow-[0_0_0_4px_rgba(162_155_254_0.15)]'
                  }`}
                >
                  {isActive && (
                    <Badge className="absolute -top-1.5 -right-1.5 text-[10px] bg-[#6C5CE7] text-white border-0 shadow-md shadow-[#6C5CE7]/30 z-10 h-5 px-1.5">
                      当前
                    </Badge>
                  )}
                  <Image
                    src={pet.image}
                    alt={pet.name}
                    className="w-20 h-20 object-contain drop-shadow-md transition-transform duration-200 group-hover:drop-shadow-lg"
                    draggable={false}
                  />
                  <div className="text-xs font-medium text-[#2D3436]">{pet.name}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-5 rounded-2xl border-0 shadow-[0_2px_12px_rgba(0_0_0_0.03)]">
        <CardHeader className="pb-0">
          <h3 className="text-base font-semibold text-[#2D3436]">互动记录</h3>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#636E72]">上次喂食</span>
            <span className="text-[#2D3436] font-medium">
              {petProfile?.lastFeedTime ? formatTime(petProfile.lastFeedTime) : '还没有喂过'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#636E72]">上次玩耍</span>
            <span className="text-[#2D3436] font-medium">
              {petProfile?.lastPlayTime ? formatTime(petProfile.lastPlayTime) : '还没一起玩过'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PetParadisePage;
