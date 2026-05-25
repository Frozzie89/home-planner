import { ref } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'hp-theme'

export const useUiStore = defineStore('ui', () => {
  const isDark = ref(false)

  function applyTheme(dark: boolean) {
    isDark.value = dark
    if (dark) {
      document.documentElement.classList.add('p-dark')
    } else {
      document.documentElement.classList.remove('p-dark')
    }
  }

  function initTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) {
        applyTheme(saved === 'dark')
        return
      }
    } catch {
      // localStorage unavailable (private browsing, sandboxed iframe)
    }
    applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches)
  }

  function toggleTheme() {
    const next = !isDark.value
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
    } catch {
      // localStorage unavailable — theme toggle still works for this session
    }
  }

  return { isDark, initTheme, toggleTheme }
})
