import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUiStore } from './ui';

type MockMediaQueryList = MediaQueryList & {
  triggerChange: (matches: boolean) => void;
};

function mockMatchMedia(matches: boolean) {
  let currentMatches = matches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    get matches() {
      return currentMatches;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((_event: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_event: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    triggerChange(nextMatches: boolean) {
      currentMatches = nextMatches;
      listeners.forEach((listener) => listener({ matches: nextMatches } as MediaQueryListEvent));
    },
  } as MockMediaQueryList;

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue(mediaQueryList),
  });

  return mediaQueryList;
}

beforeEach(() => {
  setActivePinia(createPinia());
  document.documentElement.classList.remove('p-dark');
  localStorage.clear();
  // Provide a default matchMedia stub so the store never hits undefined
  mockMatchMedia(false);
});

describe('useUiStore', () => {
  describe('initTheme()', () => {
    it('applies dark mode when localStorage preference is "dark"', () => {
      localStorage.setItem('hp-theme', 'dark');

      const store = useUiStore();
      store.initTheme();

      expect(store.isDark).toBe(true);
      expect(document.documentElement.classList.contains('p-dark')).toBe(true);
    });

    it('applies light mode when localStorage preference is "light"', () => {
      localStorage.setItem('hp-theme', 'light');

      const store = useUiStore();
      store.initTheme();

      expect(store.isDark).toBe(false);
      expect(document.documentElement.classList.contains('p-dark')).toBe(false);
    });

    it('falls back to system dark preference when no localStorage value', () => {
      mockMatchMedia(true);

      const store = useUiStore();
      store.initTheme();

      expect(store.isDark).toBe(true);
      expect(document.documentElement.classList.contains('p-dark')).toBe(true);
    });

    it('falls back to system light preference when no localStorage value', () => {
      mockMatchMedia(false);

      const store = useUiStore();
      store.initTheme();

      expect(store.isDark).toBe(false);
      expect(document.documentElement.classList.contains('p-dark')).toBe(false);
    });

    it('localStorage preference takes precedence over system preference', () => {
      localStorage.setItem('hp-theme', 'light');
      mockMatchMedia(true);

      const store = useUiStore();
      store.initTheme();

      expect(store.isDark).toBe(false);
    });

    it('updates when the system preference changes without a localStorage preference', () => {
      const mediaQueryList = mockMatchMedia(false);

      const store = useUiStore();
      store.initTheme();
      mediaQueryList.triggerChange(true);

      expect(store.isDark).toBe(true);
      expect(document.documentElement.classList.contains('p-dark')).toBe(true);

      mediaQueryList.triggerChange(false);

      expect(store.isDark).toBe(false);
      expect(document.documentElement.classList.contains('p-dark')).toBe(false);
    });

    it('ignores system preference changes after a preference is saved', () => {
      const mediaQueryList = mockMatchMedia(false);

      const store = useUiStore();
      store.initTheme();
      store.toggleTheme();

      mediaQueryList.triggerChange(false);

      expect(store.isDark).toBe(true);
      expect(document.documentElement.classList.contains('p-dark')).toBe(true);
    });

    it('does not register duplicate system preference listeners when initialized multiple times', () => {
      const mediaQueryList = mockMatchMedia(false);

      const store = useUiStore();
      store.initTheme();
      store.initTheme();

      expect(mediaQueryList.removeEventListener).toHaveBeenCalledOnce();
      expect(mediaQueryList.addEventListener).toHaveBeenCalledTimes(2);
    });
  });

  describe('toggleTheme()', () => {
    it('switches from light to dark and persists to localStorage', () => {
      const store = useUiStore();
      expect(store.isDark).toBe(false);

      store.toggleTheme();

      expect(store.isDark).toBe(true);
      expect(document.documentElement.classList.contains('p-dark')).toBe(true);
      expect(localStorage.getItem('hp-theme')).toBe('dark');
    });

    it('switches from dark to light and persists to localStorage', () => {
      localStorage.setItem('hp-theme', 'dark');
      const store = useUiStore();
      store.initTheme();

      store.toggleTheme();

      expect(store.isDark).toBe(false);
      expect(document.documentElement.classList.contains('p-dark')).toBe(false);
      expect(localStorage.getItem('hp-theme')).toBe('light');
    });
  });
});
