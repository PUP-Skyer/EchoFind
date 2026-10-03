import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type FontSize = 'small' | 'medium' | 'large';
export type Language = 'zh' | 'en';

export interface AppSettings {
  brightness: number;
  fontSize: FontSize;
  fontFamily: string;
  language: Language;
  notificationEnabled: boolean;
  statusBarEnabled: boolean;
  soundEnabled: boolean;
  petSoundCustom: Record<string, boolean>;
}

const STORAGE_KEY = 'echofind_app_settings';

const DEFAULT_SETTINGS: AppSettings = {
  brightness: 100,
  fontSize: 'medium',
  fontFamily: 'system',
  language: 'zh',
  notificationEnabled: true,
  statusBarEnabled: true,
  soundEnabled: true,
  petSoundCustom: {},
};

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface SettingsContextValue {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updatePetSound: (petType: string, enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const updatePetSound = useCallback((petType: string, enabled: boolean): void => {
    setSettings((prev) => {
      const next = {
        ...prev,
        petSoundCustom: { ...prev.petSoundCustom, [petType]: enabled },
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    root.style.setProperty('--app-brightness', `${settings.brightness}%`);

    const fontSizeMap: Record<FontSize, string> = {
      small: '13px',
      medium: '14px',
      large: '16px',
    };
    root.style.setProperty('--app-font-size', fontSizeMap[settings.fontSize]);

    const fontFamilyMap: Record<string, string> = {
      system:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
      serif: 'Georgia, "Times New Roman", serif',
      mono: '"JetBrains Mono", "Fira Code", Menlo, Consolas, monospace',
    };
    root.style.setProperty('--app-font-family', fontFamilyMap[settings.fontFamily] || fontFamilyMap.system);

    root.setAttribute('data-lang', settings.language);
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, updatePetSound }}>
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

export default SettingsContext;
