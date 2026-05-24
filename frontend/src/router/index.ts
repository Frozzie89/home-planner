import { createRouter, createWebHistory, RouterView } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/auth',
      name: 'auth',
      component: () => import('../modules/household/views/AuthView.vue'),
    },
    {
      path: '/setup',
      name: 'setup',
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

export default router
