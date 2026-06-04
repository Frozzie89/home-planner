import { createRouter, createWebHistory, RouterView } from 'vue-router'
import { useAuthStore } from '@/shared/stores/auth'
import { pb } from '@/shared/lib/pocketbase'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    shellExcluded?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/auth',
      name: 'auth',
      meta: { public: true, shellExcluded: true },
      component: () => import('../modules/household/views/AuthView.vue'),
    },
    {
      path: '/invite/:token',
      name: 'invite-accept',
      meta: { public: true, shellExcluded: true },
      component: () => import('../modules/household/views/InviteAcceptView.vue'),
    },
    {
      path: '/setup',
      name: 'setup',
      meta: { shellExcluded: true },
      component: () => import('../modules/household/views/HouseholdSetupView.vue'),
    },
    {
      path: '/finances',
      name: 'finances',
      component: () => import('../modules/finances/views/FinancesView.vue'),
    },
    {
      path: '/food',
      component: RouterView,
      children: [
        {
          path: 'meal-plan',
          name: 'food-meal-plan',
          component: () => import('../modules/food/views/MealPlanView.vue'),
        },
        {
          path: 'grocery-list',
          name: 'food-grocery-list',
          component: () => import('../modules/food/views/GroceryView.vue'),
        },
      ],
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../modules/household/views/HouseholdSettingsView.vue'),
    },
    {
      path: '/',
      redirect: '/finances',
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (authStore.initStatus !== 'success') {
    await authStore.init()
  }

  if (to.meta.public) {
    if (pb.authStore.isValid) {
      return authStore.householdId ? { path: '/finances' } : { path: '/setup' }
    }
    return true
  }

  if (!pb.authStore.isValid) {
    return { path: '/auth' }
  }

  if (!authStore.householdId && to.path !== '/setup') {
    return { path: '/setup' }
  }

  // Redirect away from /setup if household already exists (AC #5)
  if (authStore.householdId && to.path === '/setup') {
    return { path: '/finances' }
  }

  // Admin-only route guard
  if (to.path === '/settings' && authStore.role !== 'admin') {
    return { path: '/finances' }
  }

  return true
})

export default router
