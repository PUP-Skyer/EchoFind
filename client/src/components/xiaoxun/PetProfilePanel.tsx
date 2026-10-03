import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Apple, Gamepad2, Check, Pencil } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Switch } from '@client/src/components/ui/switch';
import PetAvatar from './PetAvatar';
import { PET_INFO, DEFAULT_PET, PET_NAME_MAP } from './petData';
import type { PetType, PetProfile } from '@shared/api.interface';
import * as echofindApi from '@client/src/api/echofind';
import { Image } from '@client/src/components/ui/image';

interface PetProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  petProfile: PetProfile | null;
  onProfileUpdate: (profile: PetProfile) => void;
}

const moodEmoji: Record<string, string> = {
  happy: '😊',
  normal: '😐',
  sad: '😢',
};

const moodText: Record<string, string> = {
  happy: '开心',
  normal: '平静',
  sad: '委屈',
};

const PetProfilePanel: React.FC<PetProfilePanelProps> = ({
  isOpen,
  onClose,
  petProfile,
  onProfileUpdate,
}) => {
  const [intimacyDisplay, setIntimacyDisplay] = useState<number | null>(null);
  const [isFeeding, setIsFeeding] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);

  const currentIntimacy = intimacyDisplay ?? petProfile?.intimacy ?? 0;
  const nextLevelIntimacy = petProfile?.nextLevelIntimacy ?? 100;
  const progress = Math.min(100, (currentIntimacy / nextLevelIntimacy) * 100);

  const isFeedCooldown = !!petProfile?.lastFeedTime &&
    (Date.now() - new Date(petProfile.lastFeedTime).getTime()) < 10 * 1000;
  const isPlayCooldown = !!petProfile?.lastPlayTime &&
    (Date.now() - new Date(petProfile.lastPlayTime).getTime()) < 10 * 1000;

  const handleFeed = useCallback(async () => {
    if (!petProfile || isFeeding || isFeedCooldown) return;
    setIsFeeding(true);
    try {
      const result = await echofindApi.pet.feed();
      if (result.reward > 0) {
        const startVal = petProfile.intimacy;
        const endVal = result.profile.intimacy;
        const duration = 800;
        const startTime = Date.now();
        const animate = (): void => {
          const elapsed = Date.now() - startTime;
          const t = Math.min(1, elapsed / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setIntimacyDisplay(Math.round(startVal + (endVal - startVal) * eased));
          if (t < 1) requestAnimationFrame(animate);
          else setIntimacyDisplay(null);
        };
        requestAnimationFrame(animate);
        toast.success(`喂食成功！亲密度 +${result.reward} 🍎`);
        window.dispatchEvent(new CustomEvent('echofind-pet-action', { detail: { action: 'feed' } }));
      } else {
        toast.info('刚吃过，休息一下吧~');
      }
      onProfileUpdate(result.profile);
    } catch (error) {
      logger.error('喂食失败', error);
      toast.error('喂食失败，请稍后再试');
    } finally {
      setIsFeeding(false);
    }
  }, [petProfile, isFeeding, isFeedCooldown, onProfileUpdate]);

  const handlePlay = useCallback(async () => {
    if (!petProfile || isPlaying || isPlayCooldown) return;
    setIsPlaying(true);
    try {
      const result = await echofindApi.pet.play();
      if (result.reward > 0) {
        const startVal = petProfile.intimacy;
        const endVal = result.profile.intimacy;
        const duration = 800;
        const startTime = Date.now();
        const animate = (): void => {
          const elapsed = Date.now() - startTime;
          const t = Math.min(1, elapsed / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setIntimacyDisplay(Math.round(startVal + (endVal - startVal) * eased));
          if (t < 1) requestAnimationFrame(animate);
          else setIntimacyDisplay(null);
        };
        requestAnimationFrame(animate);
        toast.success(`玩耍成功！亲密度 +${result.reward} 🎾`);
        window.dispatchEvent(new CustomEvent('echofind-pet-action', { detail: { action: 'play' } }));
      } else {
        toast.info('刚玩过，休息一下吧~');
      }
      onProfileUpdate(result.profile);
    } catch (error) {
      logger.error('玩耍失败', error);
      toast.error('玩耍失败，请稍后再试');
    } finally {
      setIsPlaying(false);
    }
  }, [petProfile, isPlaying, isPlayCooldown, onProfileUpdate]);

  const handleSetPetType = useCallback(async (type: PetType) => {
    if (!petProfile || isSwitching || petProfile.petType === type) return;
    setIsSwitching(true);
    try {
      const result = await echofindApi.pet.setPetType(type);
      onProfileUpdate(result);
      toast.success('宠物形象已切换');
    } catch (error) {
      logger.error('切换宠物失败', error);
      toast.error('切换失败，请稍后再试');
    } finally {
      setIsSwitching(false);
    }
  }, [petProfile, isSwitching, onProfileUpdate]);

  const handleToggleTts = useCallback(async (checked: boolean) => {
    if (!petProfile) return;
    try {
      const result = await echofindApi.pet.setTtsEnabled(checked);
      onProfileUpdate(result);
      toast.success(checked ? '语音播报已开启' : '语音播报已关闭');
    } catch (error) {
      logger.error('切换TTS失败', error);
      toast.error('设置失败，请稍后再试');
    }
  }, [petProfile, onProfileUpdate]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="pet-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            key="pet-panel"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 24 }}
            className="fixed left-1/2 top-1/2 z-[61] w-[480px] max-w-[92vw] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-[#F5F6FA] shadow-[0_4px_24px_rgba(0_0_0_0.08)]"
            style={{ height: 600 }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-[#636E72] hover:text-[#2D3436] transition-colors shadow-sm"
              aria-label="关闭"
            >
              <X size={16} />
            </button>

            <div className="h-full overflow-y-auto px-6 py-6">
              {/* Top section: pet avatar + name + level + mood */}
              <div className="flex flex-col items-center mb-6">
                <motion.div
                  key={petProfile?.petType}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="relative mb-3"
                >
                  <div className="w-[140px] h-[140px] rounded-full bg-gradient-to-br from-[#6C5CE7]/10 to-[#A29BFE]/20 flex items-center justify-center">
                    <PetAvatar
                      petType={petProfile?.petType ?? DEFAULT_PET}
                      size={120}
                      mood={petProfile?.mood ?? 'normal'}
                    />
                  </div>
                </motion.div>

                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-semibold text-[#2D3436]">小寻</span>
                  <button
                    className="text-[#B2BEC3] hover:text-[#6C5CE7] transition-colors"
                    onClick={() => toast.info('改名功能开发中~')}
                    aria-label="改名"
                  >
                    <Pencil size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full bg-[#6C5CE7]/10 text-[#6C5CE7] text-xs font-medium">
                    Lv.{petProfile?.level ?? 1}
                  </span>
                  <span className="text-sm text-[#636E72]">
                    {moodEmoji[petProfile?.mood ?? 'normal']} {moodText[petProfile?.mood ?? 'normal']}
                  </span>
                </div>
              </div>

              {/* Intimacy progress bar */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-[#636E72]">亲密度</span>
                  <span className="text-xs text-[#6C5CE7] font-medium">
                    {currentIntimacy} / {nextLevelIntimacy}
                  </span>
                </div>
                <div className="relative h-3 rounded-full bg-[#DFE6E9] overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE]"
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>

              {/* Interaction buttons */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={handleFeed}
                  disabled={isFeeding || isFeedCooldown || !petProfile}
                  className="flex flex-col items-center justify-center gap-1 p-4 rounded-xl bg-white border border-[#DFE6E9] hover:border-[#6C5CE7] hover:bg-[#6C5CE7]/5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-[#DFE6E9] disabled:hover:bg-white"
                >
                  <Apple size={24} className="text-[#00B894]" />
                  <span className="text-sm font-medium text-[#2D3436]">
                    {isFeedCooldown ? '刚吃过，休息一下' : '喂食 +10'}
                  </span>
                </button>
                <button
                  onClick={handlePlay}
                  disabled={isPlaying || isPlayCooldown || !petProfile}
                  className="flex flex-col items-center justify-center gap-1 p-4 rounded-xl bg-white border border-[#DFE6E9] hover:border-[#6C5CE7] hover:bg-[#6C5CE7]/5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-[#DFE6E9] disabled:hover:bg-white"
                >
                  <Gamepad2 size={24} className="text-[#FDCB6E]" />
                  <span className="text-sm font-medium text-[#2D3436]">
                    {isPlayCooldown ? '刚玩过，休息一下' : '玩耍 +15'}
                  </span>
                </button>
              </div>

              {/* Pet type selector */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-[#2D3436] mb-3">宠物形象</h3>
                <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
                  {PET_INFO.map((pet) => {
                    const active = petProfile?.petType === pet.type;
                    return (
                      <button
                        key={pet.type}
                        onClick={() => { void handleSetPetType(pet.type); }}
                        disabled={isSwitching || active}
                        className={`group relative flex flex-col items-center gap-1.5 py-2.5 px-1.5 rounded-xl border-2 transition-all duration-200 hover:scale-105 disabled:cursor-default ${
                          active
                            ? 'border-[#6C5CE7] bg-transparent shadow-[0_0_0_3px_rgba(108_92_231_0.2)] scale-105'
                            : 'border-transparent bg-transparent hover:border-[#A29BFE]/40 hover:shadow-[0_0_0_3px_rgba(162_155_254_0.15)]'
                        }`}
                      >
                        {active && (
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#6C5CE7] flex items-center justify-center z-10 shadow-md shadow-[#6C5CE7]/30">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                        <Image
                          src={pet.image}
                          alt={pet.name}
                          className="w-14 h-14 object-contain drop-shadow-md transition-transform duration-200 group-hover:drop-shadow-lg"
                          draggable={false}
                        />
                        <span className="text-xs text-[#2D3436] truncate w-full text-center font-medium">{pet.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Settings section */}
              <div>
                <h3 className="text-sm font-semibold text-[#2D3436] mb-3">设置</h3>

                {/* TTS switch */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#DFE6E9] mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#74B9FF]/10 flex items-center justify-center">
                      <Heart size={16} className="text-[#74B9FF]" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#2D3436]">TTS 语音播报</div>
                      <div className="text-xs text-[#B2BEC3]">找到物品时语音播报</div>
                    </div>
                  </div>
                  <Switch
                    checked={petProfile?.ttsEnabled ?? false}
                    onCheckedChange={handleToggleTts}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PetProfilePanel;
