# Testing Patterns Reference

Patterns discovered during Epic 1 (stories 1.3–1.5). Each one was hit in a real story; this doc exists so Epic 2 stories don't rediscover them.

---

## Pattern 1: `vi.hoisted()` for Mock Functions

### Problem

`vi.mock()` factory functions run during the module-hoisting phase, before any imports have evaluated. A `vi.fn()` declared outside the factory is `undefined` when the factory runs — the mock silently has no implementation.

### Solution

Wrap mock function creation in `vi.hoisted()`. Its callback runs in the same hoisting phase as `vi.mock`, so the functions exist when the factory references them.

```typescript
const { mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    collection: (_name: string) => ({
      create: mockCreate,
      update: mockUpdate,
    }),
  },
}))
```

### Gotcha: Vue reactivity is not available inside `vi.hoisted()`

`vi.hoisted()` runs before Vue is imported. Calling `ref()`, `reactive()`, or any Vue utility inside it throws. Declare reactive mock state in the `vi.mock` factory body instead — that runs lazily, after all imports.

```typescript
// WRONG — ref() is not yet imported
const { mockFn } = vi.hoisted(() => ({
  mockFn: vi.fn(),
  isLoading: ref(false), // throws
}))

// CORRECT — move reactive state into the factory body
const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }))

vi.mock('@/shared/stores/auth', () => ({
  useAuthStore: () => ({
    isLoading: ref(false), // fine here; factory runs after all imports
    login: mockFn,
  }),
}))
```

---

## Pattern 2: Pinia Store Mocking

### Problem

Pinia stores are singletons. State set in one test leaks into the next unless the Pinia instance is reset between tests.

A second, subtler problem: when a component test mocks a store and returns raw `ref` objects, template comparisons silently break — `store.role === 'admin'` is always `false` because `store.role` is a `Ref`, not a string.

### Solution

**Store unit tests** — call `setActivePinia(createPinia())` in `beforeEach`:

```typescript
import { setActivePinia, createPinia } from 'pinia'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})
```

**Component tests that mock a store** — return plain values, never raw `ref` objects:

```typescript
// WRONG — template comparison will fail
vi.mock('@/shared/stores/auth', () => ({
  useAuthStore: () => ({
    role: ref('member'), // Ref object, not 'member'
  }),
}))

// CORRECT — plain values work in templates
vi.mock('@/shared/stores/auth', () => ({
  useAuthStore: () => ({
    role: 'member',
    isAuthenticated: true,
    householdId: 'hh1',
  }),
}))
```

> **Why:** Components typically access store properties via `storeToRefs`, which auto-unwraps refs into plain reactive values. Mocking with raw `ref` bypasses that unwrapping and leaves a `Ref` object in the template.

---

## Pattern 3: PrimeVue Component Stubs

### Problem

PrimeVue components (`InputText`, `Select`, `Button`, etc.) require the `$primevue` plugin to be injected into the component tree at render time. Registering the full plugin in every test adds setup overhead. `<Select>` also renders a complex DOM that is impractical to interact with in jsdom.

### Solution

Stub PrimeVue components with minimal HTML equivalents in `global.stubs`. No plugin registration needed. Test data flow — assert on mock call arguments — rather than simulating UI interaction.

```typescript
const wrapper = mount(HouseholdSetupView, {
  global: {
    stubs: {
      InputText: { template: '<input />' },
      Select:    { template: '<select />' },
      Button:    { template: '<button />' },
    },
  },
})
```

Then verify the correct calls were made:

```typescript
it('creates a household with the entered name', async () => {
  await wrapper.find('input').setValue('Test Household')
  await wrapper.find('button').trigger('click')

  expect(mockCreate).toHaveBeenCalledWith({
    name: 'Test Household',
  })
})
```

> **Do not** try to simulate dropdown open/close with `<Select>` in jsdom. Test the bound model value or the downstream effect instead.
