import React from 'react';
import { PET_IMAGE_MAP } from './petData';
import type { PetType } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

interface PetAvatarProps {
  petType: PetType;
  size?: number;
  mood?: 'happy' | 'normal' | 'sad';
}

const PetAvatar: React.FC<PetAvatarProps> = ({ petType, size = 72, mood = 'normal' }) => {
  const imgSrc = PET_IMAGE_MAP[petType] ?? PET_IMAGE_MAP.cyan_dragon;
  const brightness = mood === 'happy' ? 1.05 : mood === 'sad' ? 0.92 : 1;
  const saturate = mood === 'happy' ? 1.1 : mood === 'sad' ? 0.85 : 1;

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div
        className="w-full h-full relative"
        style={{
          filter: `drop-shadow(0 4px 12px rgba(0, 0, 0, 0.12)) brightness(${brightness}) saturate(${saturate})`,
          maskImage: 'radial-gradient(ellipse 55% 50% at 50% 58%, #000 62%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(ellipse 55% 50% at 50% 58%, #000 62%, transparent 78%)',
        }}
      >
        <Image
          src={imgSrc}
          alt=""
          className="w-full h-full object-contain"
          style={{
            mixBlendMode: 'multiply',
          }}
          draggable={false}
        />
      </div>
      {mood === 'happy' && (
        <div className="absolute -top-1 -right-1 text-sm animate-bounce">✨</div>
      )}
      {mood === 'sad' && (
        <div className="absolute -top-1 -right-1 text-sm">💧</div>
      )}
    </div>
  );
};

export default PetAvatar;
