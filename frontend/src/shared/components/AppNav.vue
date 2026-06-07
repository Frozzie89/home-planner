<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/shared/stores/auth'
import { useUiStore } from '@/shared/stores/ui'
import { useHouseholdStore } from '@/modules/household/stores/household'
import UserAvatar from '@/shared/components/UserAvatar.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUiStore()
const householdStore = useHouseholdStore()

const isFinancesActive = computed(() => route.path.startsWith('/finances'))
const isFoodActive = computed(() => route.path.startsWith('/food'))
const isWideContent = computed(() => route.path === '/settings')

async function goTo(path: string) {
  try { await router.push(path) } catch { /* NavigationFailure — user already on route */ }
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="header-left">
        <RouterLink to="/finances" class="logo-link" aria-hidden="true" tabindex="-1">
          <i class="pi pi-home" />
        </RouterLink>
        <span class="app-title">Home Planner</span>
        <nav class="inline-nav" aria-label="Primary navigation">
          <RouterLink
            to="/finances"
            class="nav-link"
            :class="{ active: isFinancesActive }"
            :aria-current="isFinancesActive ? 'page' : undefined"
          >Finances</RouterLink>
          <RouterLink
            to="/food/meal-plan"
            class="nav-link"
            :class="{ active: isFoodActive }"
            :aria-current="isFoodActive ? 'page' : undefined"
          >Food</RouterLink>
        </nav>
      </div>

      <div class="header-right">
        <button
          type="button"
          class="icon-btn"
          aria-label="Toggle dark mode"
          @click="uiStore.toggleTheme()"
        >
          <i :class="uiStore.isDark ? 'pi pi-sun' : 'pi pi-moon'" />
        </button>
        <RouterLink
          v-if="authStore.role === 'admin'"
          to="/settings"
          class="icon-btn"
          aria-label="Household settings"
        >
          <i class="pi pi-cog" />
        </RouterLink>
        <RouterLink
          to="/profile"
          class="profile-pill"
          :aria-label="householdStore.name ? `My profile — ${householdStore.name}` : 'My profile'"
        >
          <UserAvatar :size="32" />
          <span v-if="householdStore.name" class="household-name">{{ householdStore.name }}</span>
        </RouterLink>
      </div>
    </header>

    <main class="app-content" :class="{ 'content-wide': isWideContent }">
      <slot />
    </main>

    <!-- Mobile only: bottom navigation bar -->
    <nav class="bottom-nav" aria-label="Bottom navigation">
      <button
        type="button"
        class="bottom-tab"
        :aria-current="isFinancesActive ? 'page' : undefined"
        :class="{ active: isFinancesActive }"
        @click="goTo('/finances')"
      >
        <i class="pi pi-wallet" />
        <span>Finances</span>
      </button>
      <button
        type="button"
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

.header-left,
.header-right {
  display: flex;
  align-items: center;
  align-self: stretch;
  gap: var(--space-1);
}

/* Logo / house icon */
.logo-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: var(--p-primary-color);
  text-decoration: none;
  font-size: 1.25rem;
  border-radius: 8px;
  flex-shrink: 0;
}

.logo-link:hover {
  background-color: var(--p-surface-hover);
}

.app-title {
  display: none;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-right: var(--space-1);
  white-space: nowrap;
}

/* Inline nav links (desktop only) */
.inline-nav {
  display: none;
  align-self: stretch;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav-link {
  display: flex;
  align-items: center;
  align-self: stretch;
  padding: 0 var(--space-2);
  text-decoration: none;
  color: var(--color-text-secondary);
  font-weight: 500;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
}

.nav-link.active {
  color: var(--color-text-primary);
  border-bottom-color: var(--p-primary-color);
}

.nav-link:hover:not(.active) {
  color: var(--color-text-primary);
}

/* Icon buttons in circles */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px; /* override global button min-height: 48px so circles stay square */
  background-color: var(--p-surface-ground);
  border: 1px solid var(--p-surface-border);
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-text-primary);
  text-decoration: none;
  font-size: 1rem;
  flex-shrink: 0;
}

.icon-btn:hover {
  background-color: var(--p-surface-hover);
}

/* Profile pill */
.profile-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  min-height: 36px; /* override global a { min-height: 48px } */
  padding: 0 2px;
  border-radius: 999px;
  text-decoration: none;
  color: var(--color-text-primary);
  background-color: var(--p-surface-ground);
}

.profile-pill:hover {
  background-color: var(--p-surface-hover);
}

.household-name {
  display: none;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
}

/* Main content */
.app-content {
  flex: 1;
  padding: var(--space-2) var(--space-2) calc(64px + var(--space-2));
}

/* Bottom nav — visible on mobile */
.bottom-nav {
  display: flex;
  margin: 0;
  padding: 0;
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
  .app-title {
    display: block;
  }

  .inline-nav {
    display: flex;
  }

  .household-name {
    display: block;
  }

  .profile-pill {
    padding: 0 10px 0 2px;
    border: 1px solid var(--p-surface-border);
  }

  .bottom-nav {
    display: none;
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
