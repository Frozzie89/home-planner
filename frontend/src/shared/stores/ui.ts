import { ref } from 'vue';
import { defineStore } from 'pinia';

const STORAGE_KEY = 'hp-theme';
const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export const useUiStore = defineStore('ui', () => {
  const isDark = ref(false);
  let colorSchemeMediaQuery: MediaQueryList | null = null;
  let removeColorSchemeListener: (() => void) | null = null;

  function applyTheme(dark: boolean) {
    isDark.value = dark;
    if (dark) {
      document.documentElement.classList.add('p-dark');
    } else {
      document.documentElement.classList.remove('p-dark');
    }
  }

  function initTheme() {
    if (removeColorSchemeListener) {
      removeColorSchemeListener();
      removeColorSchemeListener = null;
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        applyTheme(saved === 'dark');
        return;
      }
    } catch {
      // localStorage unavailable (private browsing, sandboxed iframe)
    }

    colorSchemeMediaQuery = window.matchMedia(COLOR_SCHEME_QUERY);
    applyTheme(colorSchemeMediaQuery.matches);

    const handleColorSchemeChange = (event: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(STORAGE_KEY) !== null) return;
      } catch {
        // localStorage unavailable - continue following the OS preference
      }
      applyTheme(event.matches);
    };

    const mediaQuery = colorSchemeMediaQuery;
    mediaQuery.addEventListener('change', handleColorSchemeChange);
    removeColorSchemeListener = () => {
      mediaQuery.removeEventListener('change', handleColorSchemeChange);
    };
  }

  function toggleTheme() {
    const next = !isDark.value;
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // localStorage unavailable - theme toggle still works for this session
    }
  }

  return { isDark, initTheme, toggleTheme };
});
