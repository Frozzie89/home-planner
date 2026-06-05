<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/shared/stores/auth'
import { useUiStore } from '@/shared/stores/ui'
import UserAvatar from '@/shared/components/UserAvatar.vue'

const emit = defineEmits<{
  'open-add-action': []
}>()

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUiStore()

const isFinancesActive = computed(() => route.path.startsWith('/finances'))
const isFoodActive = computed(() => route.path.startsWith('/food'))
const isWideContent = computed(() => route.path === '/settings')

async function goTo(path: string) {
  try { await router.push(path) } catch { /* NavigationFailure — user already on route */ }
}

const headerButtonLabel = computed(() => {
  if (isFinancesActive.value) return '+ Add expense'
  if (isFoodActive.value) return '+ Add item'
  return null
})
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <h1 class="app-title">Home Planner</h1>
      <div class="header-actions">
        <button
          class="theme-toggle"
          aria-label="Toggle dark mode"
          @click="uiStore.toggleTheme()"
        >
          <i :class="uiStore.isDark ? 'pi pi-sun' : 'pi pi-moon'" />
        </button>
        <RouterLink
          to="/profile"
          class="profile-link"
          aria-label="My profile"
        >
          <UserAvatar />
        </RouterLink>
        <RouterLink
          v-if="authStore.role === 'admin'"
          to="/settings"
          class="settings-link"
          aria-label="Household settings"
        >
          <i class="pi pi-cog" style="font-size: 24px" />
        </RouterLink>
        <button
          v-if="headerButtonLabel"
          class="header-add-btn"
          @click="emit('open-add-action')"
        >
          {{ headerButtonLabel }}
        </button>
      </div>
    </header>

    <!-- Desktop only: top tab nav -->
    <nav class="top-nav" role="navigation" aria-label="Primary navigation">
      <RouterLink
        to="/finances"
        class="top-nav-link"
        :class="{ active: isFinancesActive }"
        :aria-current="isFinancesActive ? 'page' : undefined"
      >Finances</RouterLink>
      <RouterLink
        to="/food/meal-plan"
        class="top-nav-link"
        :class="{ active: isFoodActive }"
        :aria-current="isFoodActive ? 'page' : undefined"
      >Food</RouterLink>
    </nav>

    <!-- Main content -->
    <main class="app-content" :class="{ 'content-wide': isWideContent }">
      <slot />
    </main>

    <!-- Mobile only: bottom navigation bar -->
    <nav class="bottom-nav" aria-label="Bottom navigation">
      <button
        class="bottom-tab"
        :aria-current="isFinancesActive ? 'page' : undefined"
        :class="{ active: isFinancesActive }"
        @click="goTo('/finances')"
      >
        <i class="pi pi-wallet" />
        <span>Finances</span>
      </button>
      <button
        class="bottom-tab"
        :aria-current="isFoodActive ? 'page' : undefined"
        :class="{ active: isFoodActive }"
        @click="goTo('/food/meal-plan')"
      >
        <i class="pi pi-shopping-cart" />
        <span>Food</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

/* Header */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-2);
  height: 56px;
  background-color: var(--p-surface-card);
  border-bottom: 1px solid var(--p-surface-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.app-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
  color: var(--color-text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.theme-toggle,
.profile-link,
.settings-link {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  min-width: 48px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-primary);
  border-radius: 8px;
  text-decoration: none;
}

.theme-toggle:hover,
.profile-link:hover,
.settings-link:hover {
  background-color: var(--p-surface-hover);
}

/* Desktop header add button — hidden on mobile */
.header-add-btn {
  display: none;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 var(--space-2);
  background-color: var(--p-primary-hover-color);
  color: var(--p-primary-contrast-color);
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.header-add-btn:hover {
  background-color: var(--p-primary-active-color);
}

/* Top nav — hidden on mobile, shown on desktop */
.top-nav {
  display: none;
}

.top-nav-link {
  display: flex;
  align-items: center;
  padding: 0 var(--space-2);
  min-height: 48px;
  text-decoration: none;
  color: var(--color-text-secondary);
  font-weight: 500;
  border-bottom: 2px solid transparent;
}

.top-nav-link.active {
  color: var(--color-text-primary);
  border-bottom-color: var(--p-primary-color);
}

/* Main content */
.app-content {
  flex: 1;
  padding: var(--space-2) var(--space-2) calc(64px + var(--space-2));
}

/* Bottom nav — visible on mobile */
.bottom-nav {
  display: flex;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background-color: var(--p-surface-card);
  border-top: 1px solid var(--p-surface-border);
  z-index: 10;
}

.bottom-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 4px;
  min-height: 48px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-family: inherit;
  padding: 0;
}

.bottom-tab.active {
  color: var(--p-primary-color);
}

.bottom-tab i {
  font-size: 1.25rem;
}

/* Desktop layout */
@media (min-width: 1024px) {
  .top-nav {
    display: flex;
    justify-content: center;
    gap: var(--space-2);
    background-color: var(--p-surface-card);
    border-bottom: 1px solid var(--p-surface-border);
    padding: 0 var(--space-4);
  }

  .bottom-nav {
    display: none;
  }

  .header-add-btn {
    display: flex;
  }

  .app-content {
    max-width: 640px;
    margin: 0 auto;
    width: 100%;
    padding-bottom: var(--space-2);
  }

  .app-content.content-wide {
    max-width: 56rem;
  }
}
</style>
