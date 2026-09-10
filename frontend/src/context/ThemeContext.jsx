import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY_MODE = 'refurbinics-theme-mode';
const STORAGE_KEY_CUSTOM = 'refurbinics-custom-theme-v9';

export const ACCENT_COLORS = [
  { id: 'emerald', name: 'Emerald Green', color: '#10b981', hover: '#059669' },
  { id: 'indigo', name: 'Modern Indigo', color: '#6366f1', hover: '#4f46e5' },
  { id: 'pink', name: 'Hot Pink', color: '#ec4899', hover: '#db2777' },
  { id: 'purple', name: 'Royal Purple', color: '#8b5cf6', hover: '#7c3aed' },
  { id: 'amber', name: 'Warm Amber', color: '#f59e0b', hover: '#d97706' },
  { id: 'crimson', name: 'Crimson Red', color: '#ef4444', hover: '#dc2626' },
  { id: 'cyan', name: 'Ocean Cyan', color: '#06b6d4', hover: '#0891b2' },
];

export const PAGE_BG_COLORS = [
  { id: 'white', name: 'Default Pure White', color: '#ffffff', darkColor: '#f1f5f9' },
  { id: 'snow', name: 'Soft Snow', color: '#f8fafc', darkColor: '#e2e8f0' },
  { id: 'blue', name: 'Soft Blue', color: '#f0f7ff', darkColor: '#bae6fd' },
  { id: 'mint', name: 'Soft Mint', color: '#f0fdf4', darkColor: '#bbf7d0' },
  { id: 'lavender', name: 'Lavender', color: '#faf5ff', darkColor: '#e9d5ff' },
  { id: 'rose', name: 'Soft Rose', color: '#fff1f2', darkColor: '#fecdd3' },
  { id: 'sand', name: 'Warm Sand', color: '#fefce8', darkColor: '#fde68a' },
];

export function darkenHex(hex, percent = 15) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex || '#ffffff';
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * (percent / 100)));
  const g = Math.max(0, ((num >> 8) & 0x00ff) - Math.round(255 * (percent / 100)));
  const b = Math.max(0, (num & 0x0000ff) - Math.round(255 * (percent / 100)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export const DEFAULT_THEME = {
  accentId: 'emerald',
  accentName: 'Emerald Green',
  accentColor: '#10b981',
  accentHover: '#059669',

  pageBgId: 'white',
  pageBgName: 'Default Pure White',
  pageBg: '#ffffff',
  pageDarkColor: '#f1f5f9',

  applyToHeader: false,
  applyToSidebar: false,

  customAccent: '#10b981',
  customPageBg: '#ffffff',
};

function getInitialMode() {
  if (typeof window === 'undefined') return 'light';
  return localStorage.getItem(STORAGE_KEY_MODE) === 'dark' ? 'dark' : 'light';
}

function getInitialCustomTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_THEME, ...parsed };
  } catch {
    return DEFAULT_THEME;
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialMode);
  const [customTheme, setCustomThemeState] = useState(getInitialCustomTheme);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MODE, theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.setProperty('--custom-page-bg', '#000000');
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.backgroundColor = '#000000';
      }
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.setProperty('--custom-page-bg', customTheme.pageBg || '#ffffff');
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.backgroundColor = customTheme.pageBg || '#ffffff';
      }
    }
  }, [theme, customTheme.pageBg]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(customTheme));
    const root = document.documentElement;
    root.style.setProperty('--custom-accent', customTheme.accentColor);
    root.style.setProperty('--custom-accent-hover', customTheme.accentHover || customTheme.accentColor);
  }, [customTheme]);

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  function setAccent(accent) {
    setCustomThemeState((prev) => ({
      ...prev,
      accentId: accent.id,
      accentName: accent.name,
      accentColor: accent.color,
      accentHover: accent.hover || accent.color,
    }));
  }

  function setCustomAccent(color) {
    setCustomThemeState((prev) => ({
      ...prev,
      accentId: 'custom',
      accentName: 'Custom Accent',
      accentColor: color,
      accentHover: color,
      customAccent: color,
    }));
  }

  function setPageBg(bg) {
    setCustomThemeState((prev) => ({
      ...prev,
      pageBgId: bg.id,
      pageBgName: bg.name,
      pageBg: bg.color,
      pageDarkColor: bg.darkColor || darkenHex(bg.color, 15),
    }));
  }

  function setCustomPageBg(color) {
    setCustomThemeState((prev) => ({
      ...prev,
      pageBgId: 'custom',
      pageBgName: 'Custom Page Bg',
      pageBg: color,
      pageDarkColor: darkenHex(color, 15),
      customPageBg: color,
    }));
  }

  function toggleApplyToHeader() {
    setCustomThemeState((prev) => ({
      ...prev,
      applyToHeader: !prev.applyToHeader,
    }));
  }

  function toggleApplyToSidebar() {
    setCustomThemeState((prev) => ({
      ...prev,
      applyToSidebar: !prev.applyToSidebar,
    }));
  }

  function resetToDefault() {
    setCustomThemeState(DEFAULT_THEME);
    setTheme('light');
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        customTheme,
        setAccent,
        setCustomAccent,
        setPageBg,
        setCustomPageBg,
        toggleApplyToHeader,
        toggleApplyToSidebar,
        resetToDefault,
        isCustomizerOpen,
        openCustomizer: () => setIsCustomizerOpen(true),
        closeCustomizer: () => setIsCustomizerOpen(false),
        toggleCustomizer: () => setIsCustomizerOpen((prev) => !prev),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
