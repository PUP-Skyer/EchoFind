import { Injectable } from '@nestjs/common';
import type { PetProfile } from '@shared/api.interface';

const PET_TYPES = [
  'white_rabbit',
  'orange_fox',
  'gray_white_cat',
  'red_panda',
  'shiba',
  'blue_smurf',
  'green_frog',
  'yellow_duck',
  'pink_pig',
  'brown_bear',
  'purple_monster',
  'white_seal',
  'orange_hamster',
  'cyan_dragon',
  'gray_penguin',
] as const;
type PetType = typeof PET_TYPES[number];

interface PetState {
  petType: PetType;
  intimacy: number;
  lastFeedTime: number | null;
  lastPlayTime: number | null;
  ttsEnabled: boolean;
}

const LEVEL_THRESHOLDS = [0, 50, 120, 220, 350, 520, 720, 960, 1240, 1560];

function getLevel(intimacy: number): { level: number; next: number } {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (intimacy >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    }
  }
  const next = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 500;
  return { level, next };
}

function computeMood(state: PetState): 'happy' | 'normal' | 'sad' {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const feedGap = state.lastFeedTime ? now - state.lastFeedTime : oneDay * 2;
  const playGap = state.lastPlayTime ? now - state.lastPlayTime : oneDay * 2;

  if (feedGap < oneDay && playGap < oneDay) return 'happy';
  if (feedGap < oneDay * 2 && playGap < oneDay * 2) return 'normal';
  return 'sad';
}

@Injectable()
export class PetService {
  private state: PetState = {
    petType: 'cyan_dragon',
    intimacy: 35,
    lastFeedTime: null,
    lastPlayTime: null,
    ttsEnabled: true,
  };

  getProfile(): PetProfile {
    const { level, next } = getLevel(this.state.intimacy);
    const mood = computeMood(this.state);
    return {
      petType: this.state.petType,
      level,
      intimacy: this.state.intimacy,
      nextLevelIntimacy: next,
      lastFeedTime: this.state.lastFeedTime ? new Date(this.state.lastFeedTime).toISOString() : null,
      lastPlayTime: this.state.lastPlayTime ? new Date(this.state.lastPlayTime).toISOString() : null,
      mood,
      ttsEnabled: this.state.ttsEnabled,
    };
  }

  setPetType(petType: string): PetProfile {
    const valid = PET_TYPES.includes(petType as PetType);
    if (!valid) {
      this.state.petType = 'cyan_dragon';
    } else {
      this.state.petType = petType as PetType;
    }
    return this.getProfile();
  }

  feed(): { profile: PetProfile; reward: number } {
    const now = Date.now();
    const cooldown = 30 * 60 * 1000;
    if (this.state.lastFeedTime && now - this.state.lastFeedTime < cooldown) {
      return { profile: this.getProfile(), reward: 0 };
    }
    const reward = 10;
    this.state.intimacy += reward;
    this.state.lastFeedTime = now;
    return { profile: this.getProfile(), reward };
  }

  play(): { profile: PetProfile; reward: number } {
    const now = Date.now();
    const cooldown = 60 * 60 * 1000;
    if (this.state.lastPlayTime && now - this.state.lastPlayTime < cooldown) {
      return { profile: this.getProfile(), reward: 0 };
    }
    const reward = 15;
    this.state.intimacy += reward;
    this.state.lastPlayTime = now;
    return { profile: this.getProfile(), reward };
  }

  setTtsEnabled(enabled: boolean): PetProfile {
    this.state.ttsEnabled = enabled;
    return this.getProfile();
  }
}
