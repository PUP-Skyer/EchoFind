import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Heart,
  Monitor,
  Type,
  Globe,
  Bell,
  Volume2,
  VolumeX,
  Info,
  LogOut,
  Star,
  Cookie,
  Gamepad2,
  User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { echofind } from '@client/src/api';
import { useSettings, type FontSize, type Language } from '@client/src/hooks/useSettings';
import { Switch } from '@client/src/components/ui/switch';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { PET_INFO, PET_NAME_MAP } from '@client/src/components/xiaoxun/petData';
import PetAvatar from '@client/src/components/xiaoxun/PetAvatar';
import { Image } from '@client/src/components/ui/image';
import type { PetType, PetProfile } from '@shared/api.interface';
import { toast } from 'sonner';

interface UserProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userRole?: string;
}

type SettingsGroupKey = 'display' | 'language' | 'notification' | 'sound' | 'about';

const GROUP_META: Record<
  SettingsGroupKey,
  { label: string; icon: React.ComponentType<{ className?: string }>; desc: string }
> = {
  display: { label: '显示', icon: Monitor, desc: '亮度、字体大小、字体选择' },
  language: { label: '语言', icon: Globe, desc: '界面显示语言' },
  notification: { label: '通知和状态栏', icon: Bell, desc: '通知与状态栏开关' },
  sound: { label: '声音', icon: Volume2, desc: '桌宠声音与自定义录音' },
  about: { label: '关于 / 更新', icon: Info, desc: '版本号与检查更新' },
};

const FONT_OPTIONS = [
  { value: 'system', label: '系统默认' },
  { value: 'serif', label: '衬线体' },
  { value: 'mono', label: '等宽体' },
];

const MOOD_LABELS: Record<string, string> = {
  happy: '开心',
  normal: '普通',
  sad: '闷闷不乐',
};

const UserProfileDrawer: React.FC<UserProfileDrawerProps> = ({
  isOpen,
  onClose,
  userName,
  userRole = '普通用户',
}) => {
  const navigate = useNavigate();
  const { settings, updateSetting, updatePetSound } = useSettings();

  const [petProfile, setPetProfile] = useState<PetProfile | null>(null);
  const [petLoading, setPetLoading] = useState(false);
  const [petActionLoading, setPetActionLoading] = useState<string | null>(null);
  const [rewardToast, setRewardToast] = useState<number | null>(null);

  const fetchPetProfile = useCallback(async (): Promise<void> => {
    setPetLoading(true);
    try {
      const data = await echofind.pet.getProfile();
      setPetProfile(data);
    } catch (err: unknown) {
      logger.error('获取宠物资料失败', err);
    } finally {
      setPetLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchPetProfile();
    }
  }, [isOpen, fetchPetProfile]);

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

  const handleLogout = (): void => {
    onClose();
    navigate('/api/v1/account/logout');
  };

  const fontSizeLabel: Record<FontSize, string> = {
    small: '小',
    medium: '中',
    large: '大',
  };

  const languageLabel: Record<Language, string> = {
    zh: '简体中文',
    en: 'English',
  };

  const handleFontSizeChange = (value: string): void => {
    updateSetting('fontSize', value as FontSize);
  };

  const handleLanguageChange = (value: string): void => {
    updateSetting('language', value as Language);
  };

  const handleFontFamilyChange = (value: string): void => {
    updateSetting('fontFamily', value);
  };

  const appVersion = 'v1.2.0';

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
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            key="drawer-panel"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-80 bg-white shadow-2xl flex flex-col"
          >
            <div className="p-5 bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] text-white relative flex-shrink-0">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                aria-label="关闭"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold shadow-lg border-2 border-white/30">
                  {userName.slice(0, 1) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold truncate">{userName}</h3>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge
                      variant="outline"
                      className="border-white/40 bg-white/15 text-white text-[10px] shadow-none py-0 h-5"
                    >
                      <Star className="h-3 w-3 mr-0.5" />
                      {userRole}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-white/40 bg-white/15 text-white text-[10px] shadow-none py-0 h-5"
                    >
                      Pro
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4">
              {/* 用户信息 */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <User className="h-4 w-4 text-[#6C5CE7]" />
                  <h4 className="text-sm font-semibold text-[#2D3436]">用户信息</h4>
                </div>
                <div className="rounded-xl bg-[#F5F6FA] p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#B2BEC3]">昵称</span>
                    <span className="text-[#2D3436] font-medium">{userName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#B2BEC3]">角色</span>
                    <span className="text-[#2D3436] font-medium">{userRole}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#B2BEC3]">套餐</span>
                    <span className="text-[#6C5CE7] font-medium">Pro 会员</span>
                  </div>
                </div>
              </section>

              {/* 桌宠乐园 */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Heart className="h-4 w-4 text-[#E17055]" />
                  <h4 className="text-sm font-semibold text-[#2D3436]">桌宠乐园</h4>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-[#FDCB6E]/10 to-[#6C5CE7]/10 p-4 flex flex-col items-center text-center relative">
                  {rewardToast !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="absolute top-2 left-1/2 -translate-x-1/2 z-10"
                    >
                      <Badge className="bg-[#FDCB6E] text-white border-0 shadow-lg shadow-[#FDCB6E]/30">
                        +{rewardToast} 亲密度
                      </Badge>
                    </motion.div>
                  )}
                  <div className="w-16 h-16 rounded-full bg-white/60 backdrop-blur-sm flex items-center justify-center shadow-md overflow-hidden mb-2">
                    {petProfile && !petLoading ? (
                      <PetAvatar
                        petType={(petProfile.petType as PetType) ?? 'cyan_dragon'}
                        size={52}
                        mood="happy"
                      />
                    ) : (
                      <span className="text-xl">🐾</span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-[#2D3436]">
                    {petProfile && !petLoading
                      ? PET_NAME_MAP[petProfile.petType as PetType] ?? '小寻'
                      : '加载中...'}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge
                      variant="outline"
                      className="border-[#6C5CE7]/20 bg-white/60 text-[#6C5CE7] shadow-none text-[10px] py-0 h-5"
                    >
                      Lv.{level}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-[#FDCB6E]/30 bg-white/60 text-[#F39C12] shadow-none text-[10px] py-0 h-5"
                    >
                      {petProfile ? MOOD_LABELS[petProfile.mood] ?? '普通' : '普通'}
                    </Badge>
                  </div>

                  <div className="w-full mt-3">
                    <div className="flex items-center justify-between text-[10px] text-[#636E72] mb-1">
                      <span className="flex items-center gap-1">
                        <Heart className="h-2.5 w-2.5 text-[#E17055]" />
                        亲密度 {intimacy}
                      </span>
                      <span>下级 {nextLevel}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/80 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 w-full">
                    <Button
                      onClick={(): Promise<void> => handleFeed()}
                      disabled={petActionLoading === 'feed' || petLoading}
                      size="sm"
                      className="bg-[#FDCB6E] hover:bg-[#F39C12] text-white flex-1 h-8 text-xs"
                    >
                      <Cookie className="h-3.5 w-3.5 mr-1" />
                      喂食
                    </Button>
                    <Button
                      onClick={(): Promise<void> => handlePlay()}
                      disabled={petActionLoading === 'play' || petLoading}
                      size="sm"
                      className="bg-[#6C5CE7] hover:bg-[#5B4CDB] text-white flex-1 h-8 text-xs"
                    >
                      <Gamepad2 className="h-3.5 w-3.5 mr-1" />
                      玩耍
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl bg-[#F5F6FA] p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-xs font-semibold text-[#2D3436]">语音播报</div>
                    <Switch
                      checked={petProfile?.ttsEnabled ?? false}
                      onCheckedChange={(checked: boolean): void => {
                        void handleToggleTts(checked);
                      }}
                    />
                  </div>
                  <div className="text-[11px] text-[#B2BEC3]">
                    {petProfile?.ttsEnabled ? '小寻会把回复读出来' : '仅文字回复'}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-[#2D3436] mb-2 px-1">
                    选择桌宠形象
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {PET_INFO.slice(0, 12).map((pet) => {
                      const isActive = petProfile?.petType === pet.type;
                      return (
                        <button
                          key={pet.type}
                          onClick={(): Promise<void> => handleSwitchPet(pet.type)}
                          className={`group relative flex flex-col items-center gap-1 py-2 px-1 rounded-xl border transition-all duration-200 ${
                            isActive
                              ? 'border-[#6C5CE7] bg-[#6C5CE7]/5 shadow-[0_0_0_3px_rgba(108_92_231_0.15)]'
                              : 'border-transparent bg-[#F5F6FA] hover:border-[#A29BFE]/40'
                          }`}
                        >
                          {isActive && (
                            <Badge className="absolute -top-1.5 -right-1.5 text-[9px] bg-[#6C5CE7] text-white border-0 shadow-md z-10 h-4 px-1">
                              当前
                            </Badge>
                          )}
                          <Image
                            src={pet.image}
                            alt={pet.name}
                            className="w-10 h-10 object-contain"
                            width={40}
                            height={40}
                            draggable={false}
                          />
                          <div className="text-[10px] text-[#2D3436] font-medium truncate w-full text-center">
                            {pet.name}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* 设置 - 全部展开 */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Monitor className="h-4 w-4 text-[#6C5CE7]" />
                  <h4 className="text-sm font-semibold text-[#2D3436]">设置</h4>
                </div>

                <div className="space-y-2">
                  {/* 显示 */}
                  <div className="rounded-xl border border-[#F5F6FA] overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-[#FAFBFF]/50 border-b border-[#F5F6FA]">
                      <div className="w-8 h-8 rounded-lg bg-[#6C5CE7]/10 flex items-center justify-center flex-shrink-0">
                        <Monitor className="h-4 w-4 text-[#6C5CE7]" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-[#2D3436]">显示</div>
                        <div className="text-[11px] text-[#B2BEC3] mt-0.5 truncate">
                          亮度、字体大小、字体选择
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-3 space-y-3 bg-white">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-[#2D3436]">亮度</label>
                          <span className="text-xs font-mono text-[#6C5CE7]">
                            {settings.brightness}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={100}
                          value={settings.brightness}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateSetting('brightness', Number(e.target.value))
                          }
                          className="w-full accent-[#6C5CE7]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-[#2D3436]">字体大小</label>
                        <div className="flex gap-2">
                          {(['small', 'medium', 'large'] as FontSize[]).map((size) => (
                            <button
                              key={size}
                              onClick={() => updateSetting('fontSize', size)}
                              className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${
                                settings.fontSize === size
                                  ? 'bg-[#6C5CE7] text-white shadow-sm'
                                  : 'bg-[#F5F6FA] text-[#636E72] hover:bg-[#EEF0F7]'
                              }`}
                            >
                              {fontSizeLabel[size]}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-[#2D3436]">字体选择</label>
                        <Select value={settings.fontFamily} onValueChange={handleFontFamilyChange}>
                          <SelectTrigger className="bg-white border-[#DFE6E9] h-8 text-xs">
                            <SelectValue placeholder="选择字体" />
                          </SelectTrigger>
                          <SelectContent>
                            {FONT_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* 语言 */}
                  <div className="rounded-xl border border-[#F5F6FA] overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-[#FAFBFF]/50 border-b border-[#F5F6FA]">
                      <div className="w-8 h-8 rounded-lg bg-[#6C5CE7]/10 flex items-center justify-center flex-shrink-0">
                        <Globe className="h-4 w-4 text-[#6C5CE7]" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-[#2D3436]">语言</div>
                        <div className="text-[11px] text-[#B2BEC3] mt-0.5 truncate">
                          界面显示语言
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-3 bg-white">
                      <div className="space-y-1.5">
                        <label className="text-xs text-[#2D3436]">界面语言</label>
                        <div className="flex gap-2">
                          {(['zh', 'en'] as Language[]).map((lang) => (
                            <button
                              key={lang}
                              onClick={() => updateSetting('language', lang)}
                              className={`flex-1 py-2 rounded-lg text-xs transition-all ${
                                settings.language === lang
                                  ? 'bg-[#6C5CE7] text-white shadow-sm'
                                  : 'bg-[#F5F6FA] text-[#636E72] hover:bg-[#EEF0F7]'
                              }`}
                            >
                              {languageLabel[lang]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 通知和状态栏 */}
                  <div className="rounded-xl border border-[#F5F6FA] overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-[#FAFBFF]/50 border-b border-[#F5F6FA]">
                      <div className="w-8 h-8 rounded-lg bg-[#6C5CE7]/10 flex items-center justify-center flex-shrink-0">
                        <Bell className="h-4 w-4 text-[#6C5CE7]" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-[#2D3436]">通知和状态栏</div>
                        <div className="text-[11px] text-[#B2BEC3] mt-0.5 truncate">
                          通知与状态栏开关
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-3 space-y-2 bg-white">
                      <div className="flex items-center justify-between py-1">
                        <div>
                          <div className="text-xs text-[#2D3436]">通知开关</div>
                          <div className="text-[10px] text-[#B2BEC3]">
                            接收告警与系统通知
                          </div>
                        </div>
                        <Switch
                          checked={settings.notificationEnabled}
                          onCheckedChange={(checked: boolean) =>
                            updateSetting('notificationEnabled', checked)
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <div>
                          <div className="text-xs text-[#2D3436]">状态栏显示</div>
                          <div className="text-[10px] text-[#B2BEC3]">
                            在状态栏显示运行状态
                          </div>
                        </div>
                        <Switch
                          checked={settings.statusBarEnabled}
                          onCheckedChange={(checked: boolean) =>
                            updateSetting('statusBarEnabled', checked)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* 声音 */}
                  <div className="rounded-xl border border-[#F5F6FA] overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-[#FAFBFF]/50 border-b border-[#F5F6FA]">
                      <div className="w-8 h-8 rounded-lg bg-[#6C5CE7]/10 flex items-center justify-center flex-shrink-0">
                        <Volume2 className="h-4 w-4 text-[#6C5CE7]" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-[#2D3436]">声音</div>
                        <div className="text-[11px] text-[#B2BEC3] mt-0.5 truncate">
                          桌宠声音与自定义录音
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-3 space-y-2 bg-white">
                      <div className="flex items-center justify-between py-1">
                        <div>
                          <div className="text-xs text-[#2D3436]">桌宠总声音</div>
                          <div className="text-[10px] text-[#B2BEC3]">
                            关闭后所有桌宠静音
                          </div>
                        </div>
                        <Switch
                          checked={settings.soundEnabled}
                          onCheckedChange={(checked: boolean) =>
                            updateSetting('soundEnabled', checked)
                          }
                        />
                      </div>

                      <div className="pt-2 border-t border-[#F5F6FA]">
                        <div className="text-[10px] text-[#B2BEC3] mb-2">
                          各桌宠声音
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {PET_INFO.slice(0, 8).map((pet) => {
                            const petSoundOn =
                              settings.petSoundCustom[pet.type] !== false;
                            return (
                              <div
                                key={pet.type}
                                className="flex items-center gap-2 py-1"
                              >
                                <div className="w-6 h-6 rounded-md bg-[#F5F6FA] flex items-center justify-center overflow-hidden flex-shrink-0">
                                  <Image
                                    src={pet.image}
                                    alt={pet.name}
                                    className="w-5 h-5 object-contain"
                                    width={20}
                                    height={20}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-medium text-[#2D3436] truncate">
                                    {pet.name}
                                  </div>
                                </div>
                                <Switch
                                  checked={petSoundOn && settings.soundEnabled}
                                  disabled={!settings.soundEnabled}
                                  onCheckedChange={(checked: boolean) =>
                                    updatePetSound(pet.type, checked)
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 关于 / 更新 */}
                  <div className="rounded-xl border border-[#F5F6FA] overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-[#FAFBFF]/50 border-b border-[#F5F6FA]">
                      <div className="w-8 h-8 rounded-lg bg-[#6C5CE7]/10 flex items-center justify-center flex-shrink-0">
                        <Info className="h-4 w-4 text-[#6C5CE7]" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-[#2D3436]">关于 / 更新</div>
                        <div className="text-[11px] text-[#B2BEC3] mt-0.5 truncate">
                          版本号与检查更新
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-3 space-y-3 bg-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-[#2D3436]">当前版本</div>
                          <div className="text-[10px] text-[#B2BEC3] font-mono">
                            {appVersion}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-[#6C5CE7]/30 text-[#6C5CE7] hover:bg-[#6C5CE7]/5"
                        onClick={() => toast('已是最新版本')}
                      >
                        检查更新
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="p-3 border-t border-[#F5F6FA] flex-shrink-0">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[#E17055] hover:bg-[#E17055]/5 transition-colors text-sm font-medium"
              >
                <LogOut size={16} />
                退出登录
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default UserProfileDrawer;
