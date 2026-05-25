import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'
import 'primeicons/primeicons.css'

import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/shared/stores/auth'

const HomePlannerPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50:  '{emerald.50}',
      100: '{emerald.100}',
      200: '{emerald.200}',
      300: '{emerald.300}',
      400: '{emerald.400}',
      500: '#5D8F72',
      600: '#4A7A5D',
      700: '#3a6349',
      800: '#2a4a36',
      900: '#1a3124',
      950: '#0e1f17',
    },
    colorScheme: {
      light: {
        surface: {
          ground:   '#FAF7F2',
          section:  '#FAF7F2',
          card:     '#F5F0E8',
          overlay:  '#F5F0E8',
          border:   '#E8E2D9',
          hover:    '#F0EBE0',
        },
        primary: {
          color:         '#5D8F72',
          contrastColor: '#ffffff',
          hoverColor:    '#4A7A5D',
          activeColor:   '#3a6349',
        },
        highlight: {
          background:      '#5D8F72',
          focusBackground: '#4A7A5D',
          color:           '#ffffff',
          focusColor:      '#ffffff',
        },
      },
      dark: {
        surface: {
          ground:   '#1A1A17',
          section:  '#1A1A17',
          card:     '#252520',
          overlay:  '#252520',
          border:   '#3A3A35',
          hover:    '#2e2e28',
        },
        primary: {
          color:         '#7AB893',
          contrastColor: '#1A1A17',
          hoverColor:    '#8FCBA6',
          activeColor:   '#9FDAB8',
        },
        highlight: {
          background:      '#7AB893',
          focusBackground: '#8FCBA6',
          color:           '#1A1A17',
          focusColor:      '#1A1A17',
        },
      },
    },
  },
})

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: HomePlannerPreset,
    options: {
      darkModeSelector: '.p-dark',
      cssLayer: false,
    },
  },
})

const authStore = useAuthStore()
await authStore.init()

app.mount('#app')
