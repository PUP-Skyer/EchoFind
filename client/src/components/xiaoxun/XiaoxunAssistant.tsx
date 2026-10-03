import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, type Easing } from 'framer-motion';
import { logger } from '@lark-apaas/client-toolkit/logger';
import ChatPanel from './ChatPanel';
import ItemDetailModal from './ItemDetailModal';
import PetAvatar from './PetAvatar';
import PetProfilePanel from './PetProfilePanel';
import { DEFAULT_PET } from './petData';
import type { PetType } from '@shared/api.interface';
import { useXiaoxunChat } from './useXiaoxunChat';
import * as echofindApi from '@client/src/api/echofind';
import type { Item, PetProfile } from '@shared/api.interface';

const PET_SIZE = 72;
const DRAG_THRESHOLD = 5;
const STORAGE_KEY = 'xiaoxun-pet-position';
const DEFAULT_RIGHT = 24;
const DEFAULT_BOTTOM = 24;

type ActionAnimType = 'idle' | 'jump' | 'feed' | 'play';

const XiaoxunAssistant: React.FC = () => {
  const navigate = useNavigate();
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [petProfile, setPetProfile] = useState<PetProfile | null>(null);

  // Drag & position state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [actionAnim, setActionAnim] = useState<ActionAnimType>('idle');
  const dragStartRef = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
  }>({ x: 0, y: 0, startX: 0, startY: 0, moved: false });
  const isPointerDownRef = useRef<boolean>(false);

  const {
    messages,
    isLoading,
    messagesEndRef,
    sendMessage,
    showWeatherCard,
    showScheduleCard,
    addScheduleItem,
    recognizePhoto,
    recognizeVoice,
    searchItems,
    currentPendingItem,
    quickEntryItem,
  } = useXiaoxunChat();

  // Clamp position so pet stays fully within viewport
  const clampPosition = useCallback((x: number, y: number): { x: number; y: number } => {
    const margin = 4;
    const minX = margin;
    const maxX = window.innerWidth - PET_SIZE - margin;
    const minY = margin;
    const maxY = window.innerHeight - PET_SIZE - margin;
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  }, []);

  // Initialize position from localStorage or default (bottom-right)
  // If saved position is too far out of view (e.g. sidebar was widened), reset to default.
  useEffect(() => {
    const defaultX = window.innerWidth - PET_SIZE - DEFAULT_RIGHT;
    const defaultY = window.innerHeight - PET_SIZE - DEFAULT_BOTTOM;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { x: number; y: number };
        const visibleThreshold = PET_SIZE * 0.5;
        const isVisibleX =
          parsed.x + visibleThreshold > 0 &&
          parsed.x < window.innerWidth - visibleThreshold;
        const isVisibleY =
          parsed.y + visibleThreshold > 0 &&
          parsed.y < window.innerHeight - visibleThreshold;
        if (isVisibleX && isVisibleY) {
          const clamped = clampPosition(parsed.x, parsed.y);
          setPosition(clamped);
          return;
        }
      } catch {
        // fall through to default
      }
    }
    setPosition({ x: defaultX, y: defaultY });
  }, [clampPosition]);

  // Save position to localStorage
  const savePosition = useCallback((x: number, y: number): void => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
    } catch {
      // ignore storage errors
    }
  }, []);

  // Load pet profile on mount
  useEffect(() => {
    const loadProfile = async (): Promise<void> => {
      try {
        const profile = await echofindApi.pet.getProfile();
        setPetProfile(profile);
      } catch (error) {
        logger.error('加载宠物档案失败', error);
      }
    };
    void loadProfile();

    const handlePetTypeChanged = (event: Event): void => {
      const customEvent = event as CustomEvent<{ petType: string }>;
      if (customEvent.detail?.petType) {
        setPetProfile((prev) => prev ? { ...prev, petType: customEvent.detail.petType as PetType } : prev);
      }
    };
    window.addEventListener('echofind-pet-type-changed', handlePetTypeChanged);
    return () => window.removeEventListener('echofind-pet-type-changed', handlePetTypeChanged);
  }, []);

  const handleTogglePanel = useCallback((): void => {
    setIsPanelOpen((prev: boolean) => !prev);
  }, []);

  const handleOpenProfile = useCallback((e: React.MouseEvent): void => {
    e.stopPropagation();
    setIsProfileOpen(true);
  }, []);

  const handleCloseProfile = useCallback((): void => {
    setIsProfileOpen(false);
  }, []);

  const handleProfileUpdate = useCallback((profile: PetProfile): void => {
    setPetProfile(profile);
  }, []);

  const handleItemClick = (item: Item): void => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = (): void => {
    setIsModalOpen(false);
  };

  const handleFindItem = useCallback((item: Item): void => {
    setIsPanelOpen(false);
    setIsModalOpen(false);
    navigate(`/find/${item.id}`);
  }, [navigate]);

  // --- Drag handlers ---

  const handlePointerDown = useCallback((e: React.PointerEvent): void => {
    if (!position) return;
    e.preventDefault();
    isPointerDownRef.current = true;
    dragStartRef.current = {
      x: position.x,
      y: position.y,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    setIsDragging(false);
    const target = e.target as Element;
    if ('setPointerCapture' in target) {
      target.setPointerCapture(e.pointerId);
    }
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent): void => {
    if (!position) return;
    if (!isPointerDownRef.current) return;
    const { startX, startY, x, y, moved } = dragStartRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
        return;
      }
      dragStartRef.current.moved = true;
      setIsDragging(true);
      const newPos = clampPosition(x + dx, y + dy);
      setPosition(newPos);
      return;
    }

    const newPos = clampPosition(x + dx, y + dy);
    setPosition(newPos);
  }, [position, clampPosition]);

  const handlePointerUp = useCallback((e: React.PointerEvent): void => {
    if (!position) return;
    isPointerDownRef.current = false;
    const target = e.target as Element;
    if ('releasePointerCapture' in target) {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (dragStartRef.current.moved) {
      // Drag end — save position
      savePosition(position.x, position.y);
      setIsDragging(false);
    } else {
      // Click — play happy jump, then open panel
      setActionAnim('jump');
      window.setTimeout(() => {
        setActionAnim('idle');
        handleTogglePanel();
      }, 300);
    }
  }, [position, savePosition, handleTogglePanel]);

  // --- Pet action CustomEvent listener (feed / play) ---

  useEffect(() => {
    const handlePetAction = (event: Event): void => {
      const customEvent = event as CustomEvent<{ action: string }>;
      const action = customEvent.detail?.action;
      if (action === 'feed' || action === 'play') {
        setActionAnim(action);
        const duration = action === 'feed' ? 500 : 600;
        window.setTimeout(() => {
          setActionAnim('idle');
        }, duration);
      }
    };
    window.addEventListener('echofind-pet-action', handlePetAction);
    return () => window.removeEventListener('echofind-pet-action', handlePetAction);
  }, []);

  // Handle window resize — re-clamp position
  useEffect(() => {
    const handleResize = (): void => {
      setPosition((prev) => {
        if (!prev) return prev;
        return clampPosition(prev.x, prev.y);
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  const petType = petProfile?.petType ?? DEFAULT_PET;

  // Compute inner animation target based on state
  const innerAnimate = ((): {
    scale?: number | number[];
    y?: number | number[];
    x?: number | number[];
    rotate?: number | number[];
  } => {
    if (isDragging) {
      return { scale: 0.9, x: 0, y: 0, rotate: 0 };
    }
    if (actionAnim === 'jump') {
      return { y: [0, -18, 0], scale: [1, 1.12, 1] };
    }
    if (actionAnim === 'feed') {
      return { y: [0, -10, 2, -6, 0], scale: [1, 1.1, 0.95, 1.05, 1] };
    }
    if (actionAnim === 'play') {
      return { x: [-8, 8, -8, 8, 0], rotate: [-8, 8, -8, 8, 0] };
    }
    return { scale: 1, x: 0, y: 0, rotate: 0 };
  })();

  const innerTransition = ((): {
    duration?: number;
    ease?: Easing | Easing[];
  } => {
    if (actionAnim === 'jump') {
      return { duration: 0.3, ease: 'easeOut' as Easing };
    }
    if (actionAnim === 'feed') {
      return { duration: 0.5, ease: 'easeInOut' as Easing };
    }
    if (actionAnim === 'play') {
      return { duration: 0.6, ease: 'easeInOut' as Easing };
    }
    return { duration: 0.2 };
  })();

  if (!position) {
    return null;
  }

  return (
    <>
      {/* Floating Pet */}
      {!isPanelOpen && (
        <motion.div
          className="fixed z-50 select-none touch-none"
          style={{
            left: position.x,
            top: position.y,
            width: PET_SIZE,
            height: PET_SIZE,
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring', stiffness: 200, damping: 18 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="button"
          aria-label="打开小寻助手"
          tabIndex={0}
        >
          {/* Breathing float animation (outer) */}
          <motion.div
            className="w-full h-full"
            animate={{
              y: [0, -3, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {/* Action / drag animation (inner) */}
            <motion.div
              className="w-full h-full"
              style={{
                filter: 'drop-shadow(0 4px 16px rgba(108, 92, 231, 0.25))',
              }}
              animate={innerAnimate}
              transition={innerTransition}
            >
              <PetAvatar petType={petType} size={PET_SIZE} mood={petProfile?.mood ?? 'normal'} />
            </motion.div>
          </motion.div>
        </motion.div>
      )}

      {/* Chat Panel */}
      <ChatPanel
        isOpen={isPanelOpen}
        onClose={handleTogglePanel}
        messages={messages}
        isLoading={isLoading}
        messagesEndRef={messagesEndRef}
        onSendMessage={sendMessage}
        onShowWeather={showWeatherCard}
        onShowSchedule={showScheduleCard}
        onAddSchedule={addScheduleItem}
        onRecognizePhoto={recognizePhoto}
        onRecognizeVoice={recognizeVoice}
        onSearchItems={searchItems}
        onItemClick={handleItemClick}
        onFindItem={handleFindItem}
        currentPendingItem={currentPendingItem}
        petType={petType}
        onQuickEntryConfirm={(name: string): void => {
          void quickEntryItem(name);
        }}
        onQuickEntryCancel={(): void => {
          sendMessage('取消登记');
        }}
      />

      {/* Pet Profile Panel */}
      <PetProfilePanel
        isOpen={isProfileOpen}
        onClose={handleCloseProfile}
        petProfile={petProfile}
        onProfileUpdate={handleProfileUpdate}
      />

      {/* Item Detail Modal */}
      <ItemDetailModal
        item={selectedItem}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onMarkBrought={() => { /* no-op */ }}
        isMarked={false}
        onFind={handleFindItem}
      />
    </>
  );
};

export default XiaoxunAssistant;
