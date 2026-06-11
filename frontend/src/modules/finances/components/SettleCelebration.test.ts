import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SettleCelebration from './SettleCelebration.vue'

describe('SettleCelebration', () => {
  it('renders an aria-live="polite" region', () => {
    const wrapper = mount(SettleCelebration, {
      props: { active: false, otherMemberName: 'Bob' },
    })
    expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true)
  })

  it('announces "Balance settled with [Name]" when active becomes true', async () => {
    const wrapper = mount(SettleCelebration, {
      props: { active: false, otherMemberName: 'Bob' },
    })
    await wrapper.setProps({ active: true })
    await flushPromises()
    expect(wrapper.find('[aria-live="polite"]').text()).toBe('Balance settled with Bob')
  })

  it('clears the announcement when active becomes false', async () => {
    const wrapper = mount(SettleCelebration, {
      props: { active: true, otherMemberName: 'Bob' },
    })
    await wrapper.setProps({ active: false })
    await flushPromises()
    expect(wrapper.find('[aria-live="polite"]').text()).toBe('')
  })
})
