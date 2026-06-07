import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import AppNav from './AppNav.vue'

// Plain mock fns hoisted so vi.mock factories can close over them
const { mockToggleTheme, mockInitTheme } = vi.hoisted(() => ({
  mockToggleTheme: vi.fn(),
  mockInitTheme: vi.fn(),
}))

// Reactive refs at module level — initialized after imports, before tests run.
// The vi.mock factories below close over these by reference; by the time
// useUiStore() / useAuthStore() are called inside mount(), both refs exist.
const mockIsDark = ref(false)
const mockRole = ref<'admin' | 'member' | null>('member')

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    authStore: {
      record: { id: 'user-1', avatar: '', name: 'Helen' },
      onChange: vi.fn(() => () => {}),
    },
    files: {
      getURL: vi.fn().mockReturnValue(''),
    },
  },
}))

vi.mock('@/shared/stores/ui', () => ({
  useUiStore: () => ({
    get isDark() { return mockIsDark.value },
    toggleTheme: mockToggleTheme,
    initTheme: mockInitTheme,
  }),
}))

vi.mock('@/shared/stores/auth', () => ({
  useAuthStore: () => ({
    get role() { return mockRole.value },
    isAuthenticated: true,
    householdId: 'hh1',
  }),
}))

vi.mock('@/modules/household/stores/household', () => ({
  useHouseholdStore: () => ({
    name: 'The Hostel',
  }),
}))

function makeRouter(initialPath = '/finances') {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/finances', component: { template: '<div />' } },
      { path: '/food/meal-plan', component: { template: '<div />' } },
      { path: '/settings', component: { template: '<div />' } },
    ],
  })
  router.push(initialPath)
  return router
}

async function mountNav(path = '/finances', role: 'admin' | 'member' = 'member') {
  mockRole.value = role
  const router = makeRouter(path)
  await router.isReady()
  return mount(AppNav, {
    global: {
      plugins: [createPinia(), router],
    },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockIsDark.value = false
  mockRole.value = 'member'
})

describe('AppNav', () => {
  describe('bottom tab bar (mobile structure)', () => {
    it('renders bottom nav with two tabs', async () => {
      const wrapper = await mountNav('/finances')
      const bottomNav = wrapper.find('[aria-label="Bottom navigation"]')
      expect(bottomNav.exists()).toBe(true)
      const tabs = bottomNav.findAll('.bottom-tab')
      expect(tabs).toHaveLength(2)
      expect(tabs[0]!.text()).toContain('Finances')
      expect(tabs[1]!.text()).toContain('Food')
    })

    it('marks Finances tab as active when on /finances route', async () => {
      const wrapper = await mountNav('/finances')
      const tabs = wrapper.findAll('.bottom-tab')
      expect(tabs[0]!.attributes('aria-current')).toBe('page')
      expect(tabs[1]!.attributes('aria-current')).toBeUndefined()
    })

    it('marks Food tab as active when on /food/meal-plan route', async () => {
      const wrapper = await mountNav('/food/meal-plan')
      const tabs = wrapper.findAll('.bottom-tab')
      expect(tabs[0]!.attributes('aria-current')).toBeUndefined()
      expect(tabs[1]!.attributes('aria-current')).toBe('page')
    })

    it('active tab has active class applied', async () => {
      const wrapper = await mountNav('/finances')
      const tabs = wrapper.findAll('.bottom-tab')
      expect(tabs[0]!.classes()).toContain('active')
      expect(tabs[1]!.classes()).not.toContain('active')
    })
  })

  describe('gear icon (admin-only)', () => {
    it('renders gear icon link when role is admin', async () => {
      const wrapper = await mountNav('/finances', 'admin')
      expect(wrapper.find('[aria-label="Household settings"]').exists()).toBe(true)
    })

    it('does NOT render gear icon when role is member', async () => {
      const wrapper = await mountNav('/finances', 'member')
      expect(wrapper.find('[aria-label="Household settings"]').exists()).toBe(false)
    })
  })

  describe('dark mode toggle', () => {
    it('calls uiStore.toggleTheme when toggle button is clicked', async () => {
      const wrapper = await mountNav('/finances')
      await wrapper.find('[aria-label="Toggle dark mode"]').trigger('click')
      expect(mockToggleTheme).toHaveBeenCalledOnce()
    })

    it('shows sun icon when isDark is true', async () => {
      mockIsDark.value = true
      const wrapper = await mountNav('/finances')
      const icon = wrapper.find('[aria-label="Toggle dark mode"] i')
      expect(icon.classes()).toContain('pi-sun')
    })

    it('shows moon icon when isDark is false', async () => {
      mockIsDark.value = false
      const wrapper = await mountNav('/finances')
      const icon = wrapper.find('[aria-label="Toggle dark mode"] i')
      expect(icon.classes()).toContain('pi-moon')
    })
  })

  describe('inline nav links (desktop)', () => {
    it('renders Finances and Food nav links', async () => {
      const wrapper = await mountNav('/finances')
      const nav = wrapper.find('[aria-label="Primary navigation"]')
      expect(nav.exists()).toBe(true)
      const links = nav.findAll('a')
      expect(links).toHaveLength(2)
      expect(links[0]!.text()).toBe('Finances')
      expect(links[1]!.text()).toBe('Food')
    })

    it('marks Finances link active on /finances route', async () => {
      const wrapper = await mountNav('/finances')
      const nav = wrapper.find('[aria-label="Primary navigation"]')
      const links = nav.findAll('a')
      expect(links[0]!.attributes('aria-current')).toBe('page')
      expect(links[1]!.attributes('aria-current')).toBeUndefined()
    })

    it('marks Food link active on /food/meal-plan route', async () => {
      const wrapper = await mountNav('/food/meal-plan')
      const nav = wrapper.find('[aria-label="Primary navigation"]')
      const links = nav.findAll('a')
      expect(links[0]!.attributes('aria-current')).toBeUndefined()
      expect(links[1]!.attributes('aria-current')).toBe('page')
    })
  })

  describe('profile pill', () => {
    it('shows household name inside the profile pill', async () => {
      const wrapper = await mountNav('/finances')
      const pill = wrapper.find('[aria-label="My profile — The Hostel"]')
      expect(pill.find('.household-name').text()).toBe('The Hostel')
    })
  })

  describe('profile link', () => {
    it('includes household name in profile link aria-label', async () => {
      const wrapper = await mountNav('/finances')
      const profileLink = wrapper.find('[aria-label="My profile — The Hostel"]')
      expect(profileLink.exists()).toBe(true)
    })
  })

  describe('app shell structure', () => {
    it('renders the app title', async () => {
      const wrapper = await mountNav('/finances')
      expect(wrapper.find('.app-title').text()).toBe('Home Planner')
    })

    it('renders slot content in main element', async () => {
      const router = makeRouter('/finances')
      await router.isReady()
      const wrapper = mount(AppNav, {
        global: { plugins: [createPinia(), router] },
        slots: { default: '<p class="slot-content">Hello</p>' },
      })
      expect(wrapper.find('.slot-content').exists()).toBe(true)
    })
  })
})
