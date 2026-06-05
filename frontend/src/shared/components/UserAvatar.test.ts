import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

// Hoisted so vi.mock factory can close over them
const { mockGetFileUrl } = vi.hoisted(() => ({
  mockGetFileUrl: vi.fn(),
}))

// Module-level reactive record — getter in mock closes over this by reference
const mockRecord = ref<Record<string, unknown> | null>(null)

// Capture the onChange callback so tests can trigger it directly
let onChangeCallback: ((token: string, model: Record<string, unknown> | null) => void) | null = null

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    get authStore() {
      return {
        record: mockRecord.value,
        onChange: (cb: (token: string, model: Record<string, unknown> | null) => void) => {
          onChangeCallback = cb
          return () => { onChangeCallback = null }
        },
      }
    },
    files: {
      getURL: mockGetFileUrl,
    },
  },
}))

import UserAvatar from './UserAvatar.vue'

beforeEach(() => {
  vi.clearAllMocks()
  mockRecord.value = null
  onChangeCallback = null
})

describe('UserAvatar', () => {
  it('renders <img> with correct src when user has an avatar', () => {
    mockRecord.value = { id: 'user-1', avatar: 'photo.jpg', name: 'Helen' }
    mockGetFileUrl.mockReturnValue('https://pb.example.com/files/photo.jpg')

    const wrapper = mount(UserAvatar)

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://pb.example.com/files/photo.jpg')
    expect(mockGetFileUrl).toHaveBeenCalledWith(
      { id: 'user-1', avatar: 'photo.jpg', name: 'Helen' },
      'photo.jpg'
    )
  })

  it('renders initials circle (no <img>) when avatar is empty string', () => {
    mockRecord.value = { id: 'user-2', avatar: '', name: 'Helen' }

    const wrapper = mount(UserAvatar)

    expect(wrapper.find('img').exists()).toBe(false)
    const span = wrapper.find('span')
    expect(span.exists()).toBe(true)
    expect(span.text()).toBe('H')
  })

  it('renders initials circle (no <img>) when avatar is falsy (null)', () => {
    mockRecord.value = { id: 'user-3', avatar: null, name: 'Bob' }

    const wrapper = mount(UserAvatar)

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('span').text()).toBe('B')
  })

  it('falls back to username initial when name is absent', () => {
    mockRecord.value = { id: 'user-4', avatar: '', name: '', username: 'jdoe' }

    const wrapper = mount(UserAvatar)

    expect(wrapper.find('span').text()).toBe('J')
  })

  it('falls back to email initial when name and username are absent', () => {
    mockRecord.value = { id: 'user-5', avatar: '', name: '', username: '', email: 'z@example.com' }

    const wrapper = mount(UserAvatar)

    expect(wrapper.find('span').text()).toBe('Z')
  })

  it('falls back to "?" when name, username, and email are all absent', () => {
    mockRecord.value = { id: 'user-6', avatar: '' }

    const wrapper = mount(UserAvatar)

    expect(wrapper.find('span').text()).toBe('?')
  })

  it('background color is deterministic — same id always yields the same color', () => {
    mockRecord.value = { id: 'abc', avatar: '', name: 'Test' }

    const wrapper1 = mount(UserAvatar)
    const color1 = wrapper1.find('span').attributes('style')

    const wrapper2 = mount(UserAvatar)
    const color2 = wrapper2.find('span').attributes('style')

    expect(color1).toBe(color2)
    // jsdom normalizes hex to rgb() — just verify a background-color is present
    expect(color1).toMatch(/background-color:/)
  })

  it('initial letter is uppercase', () => {
    mockRecord.value = { id: 'user-7', avatar: '', name: 'alice' }

    const wrapper = mount(UserAvatar)

    expect(wrapper.find('span').text()).toBe('A')
  })

  it('uses size prop to set width and height', () => {
    mockRecord.value = { id: 'user-8', avatar: '', name: 'Test' }

    const wrapper = mount(UserAvatar, { props: { size: 72 } })
    const span = wrapper.find('span')

    expect(span.attributes('style')).toContain('width: 72px')
    expect(span.attributes('style')).toContain('height: 72px')
  })

  it('updates to show <img> when onChange fires with a new record that has an avatar', async () => {
    mockRecord.value = { id: 'user-9', avatar: '', name: 'Test' }
    mockGetFileUrl.mockReturnValue('https://pb.example.com/new-photo.jpg')

    const wrapper = mount(UserAvatar)
    expect(wrapper.find('img').exists()).toBe(false)

    // Simulate pb.authStore.save() triggering the onChange callback
    onChangeCallback!('token', { id: 'user-9', avatar: 'new-photo.jpg', name: 'Test' })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.find('img').attributes('src')).toBe('https://pb.example.com/new-photo.jpg')
  })
})
