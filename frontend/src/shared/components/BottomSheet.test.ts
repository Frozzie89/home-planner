import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BottomSheet from './BottomSheet.vue'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
})

describe('BottomSheet', () => {
  let wrapper: ReturnType<typeof mount>

  afterEach(() => {
    wrapper?.unmount()
    // Clean up any teleported nodes left in body
    document.body.querySelectorAll('.sheet-overlay').forEach(el => el.remove())
  })

  it('does not render sheet when open is false', () => {
    wrapper = mount(BottomSheet, {
      props: { open: false },
      attachTo: document.body,
    })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders sheet with content when open is true', async () => {
    wrapper = mount(BottomSheet, {
      props: { open: true, title: 'Test Sheet' },
      slots: { default: '<button id="test-btn">Click me</button>' },
      attachTo: document.body,
    })
    await flushPromises()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(document.body.querySelector('#test-btn')).not.toBeNull()
  })

  it('renders title in .sheet-title when title prop provided', async () => {
    wrapper = mount(BottomSheet, {
      props: { open: true, title: 'My Title' },
      attachTo: document.body,
    })
    await flushPromises()
    const title = document.body.querySelector('.sheet-title')
    expect(title).not.toBeNull()
    expect(title!.textContent).toBe('My Title')
  })

  it('has role="dialog" and aria-modal="true" when open', async () => {
    wrapper = mount(BottomSheet, {
      props: { open: true },
      attachTo: document.body,
    })
    await flushPromises()
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog!.getAttribute('aria-modal')).toBe('true')
  })

  it('closes when clicking the backdrop overlay', async () => {
    wrapper = mount(BottomSheet, {
      props: { open: true },
      attachTo: document.body,
    })
    await flushPromises()
    const overlay = document.body.querySelector('.sheet-overlay') as HTMLElement
    expect(overlay).not.toBeNull()
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })

  it('does not close when clicking inside the sheet', async () => {
    wrapper = mount(BottomSheet, {
      props: { open: true },
      slots: { default: '<button id="inner">Inner</button>' },
      attachTo: document.body,
    })
    await flushPromises()
    const sheet = document.body.querySelector('.sheet') as HTMLElement
    expect(sheet).not.toBeNull()
    sheet.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    // click.self on overlay means clicking the sheet (not the overlay) should not close
    expect(wrapper.emitted('update:open')).toBeFalsy()
  })

  it('closes on Escape key press', async () => {
    wrapper = mount(BottomSheet, {
      props: { open: true },
      attachTo: document.body,
    })
    await flushPromises()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })

  it('does not close on non-Escape key press', async () => {
    wrapper = mount(BottomSheet, {
      props: { open: true },
      attachTo: document.body,
    })
    await flushPromises()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    expect(wrapper.emitted('update:open')).toBeFalsy()
  })

  it('Tab from last focusable element wraps to first', async () => {
    wrapper = mount(BottomSheet, {
      props: { open: true, title: 'Trap Test' },
      slots: { default: '<button id="btn-a">A</button><button id="btn-b">B</button>' },
      attachTo: document.body,
    })
    await flushPromises()
    // The sheet has: close button (header) + btn-a + btn-b
    const focusable = Array.from(
      document.body.querySelectorAll<HTMLElement>('button:not([disabled])')
    )
    const last = focusable[focusable.length - 1]!
    last.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    await flushPromises()
    // focus should have moved to the first focusable element
    expect(document.activeElement).toBe(focusable[0])
  })

  it('Shift+Tab from first focusable element wraps to last', async () => {
    wrapper = mount(BottomSheet, {
      props: { open: true, title: 'Trap Test' },
      slots: { default: '<button id="btn-a">A</button><button id="btn-b">B</button>' },
      attachTo: document.body,
    })
    await flushPromises()
    const focusable = Array.from(
      document.body.querySelectorAll<HTMLElement>('button:not([disabled])')
    )
    const first = focusable[0]!
    first.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    await flushPromises()
    expect(document.activeElement).toBe(focusable[focusable.length - 1])
  })

  it('close button emits update:open false', async () => {
    wrapper = mount(BottomSheet, {
      props: { open: true, title: 'With Header' },
      attachTo: document.body,
    })
    await flushPromises()
    const closeBtn = document.body.querySelector('.sheet-close') as HTMLElement
    expect(closeBtn).not.toBeNull()
    closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })
})
