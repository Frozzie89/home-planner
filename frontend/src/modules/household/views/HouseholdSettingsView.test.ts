import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
});

const {
  mockGetOne,
  mockGetFullList,
  mockGetFirstListItem,
  mockUpdate,
  mockUpdateMember,
  mockCreate,
  mockDelete,
  mockToastAdd,
  mockPopulate,
  mockRouterBack,
  mockRouterPush,
  mockSend,
  mockLoadMembership,
} = vi.hoisted(() => ({
  mockGetOne: vi.fn(),
  mockGetFullList: vi.fn(),
  mockGetFirstListItem: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMember: vi.fn(),
  mockCreate: vi.fn(),
  mockDelete: vi.fn(),
  mockToastAdd: vi.fn(),
  mockPopulate: vi.fn(),
  mockRouterBack: vi.fn(),
  mockRouterPush: vi.fn(),
  mockSend: vi.fn(),
  mockLoadMembership: vi.fn(),
}));

vi.mock('@/shared/lib/pocketbase', () => ({
  pb: {
    filter: (expr: string, params: Record<string, unknown>) => {
      return Object.entries(params).reduce((s, [k, v]) => s.replace(`{:${k}}`, String(v)), expr);
    },
    collection: (name: string) => ({
      getOne: name === 'households' ? mockGetOne : vi.fn(),
      getFullList: name === 'members' ? mockGetFullList : vi.fn(),
      getFirstListItem: name === 'invitations' ? mockGetFirstListItem : vi.fn(),
      update: name === 'households' ? mockUpdate : name === 'members' ? mockUpdateMember : vi.fn(),
      create: name === 'invitations' ? mockCreate : vi.fn(),
      delete: name === 'members' ? mockDelete : vi.fn(),
    }),
    authStore: {
      record: { id: 'user-test', avatar: '', name: 'Helen' },
      onChange: vi.fn(() => () => {}),
    },
    files: {
      getURL: vi.fn().mockReturnValue(''),
    },
    send: mockSend,
  },
}));

vi.mock('@/shared/stores/auth', () => ({
  useAuthStore: () => ({
    householdId: 'hh-test',
    role: 'admin',
    userId: 'user-test',
    isAuthenticated: true,
    loadMembership: mockLoadMembership,
  }),
}));

vi.mock('@/modules/household/stores/household', () => ({
  useHouseholdStore: () => ({
    populate: mockPopulate,
    id: 'hh-test',
    name: 'Test Household',
    currency: 'EUR',
    split_ratios: {},
    reminder_day: 'Monday',
  }),
}));

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd }),
}));

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return {
    ...actual,
    useRouter: () => ({ back: mockRouterBack, push: mockRouterPush }),
    useRoute: () => ({ path: '/settings' }),
  };
});

import HouseholdSettingsView from './HouseholdSettingsView.vue';

const MOCK_HOUSEHOLD = {
  id: 'hh-test',
  name: 'Test Household',
  currency: 'EUR',
  split_ratios: { 'member-1': 60, 'member-2': 40 },
  reminder_day: 'Monday',
  created: '',
  updated: '',
};

const MOCK_MEMBERS = [
  {
    id: 'member-1',
    household_id: 'hh-test',
    role: 'admin' as const,
    user_id: 'user-1',
    created: '',
    updated: '',
    expand: { user_id: { id: 'user-1', name: 'Helen', email: 'helen@test.com', avatar: '' } },
  },
  {
    id: 'member-2',
    household_id: 'hh-test',
    role: 'member' as const,
    user_id: 'user-2',
    created: '',
    updated: '',
    expand: { user_id: { id: 'user-2', name: 'Alex', email: 'alex@test.com', avatar: '' } },
  },
];

function mountView() {
  return mount(HouseholdSettingsView, {
    global: {
      plugins: [createPinia()],
      stubs: {
        InputText: {
          template:
            '<input :id="id" :value="modelValue" :class="$attrs.class" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />',
          props: ['modelValue', 'id', 'maxlength'],
          emits: ['update:modelValue', 'blur'],
          inheritAttrs: false,
        },
        InputNumber: {
          template:
            '<input type="number" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
          props: ['modelValue', 'disabled', 'min', 'max', 'suffix'],
          emits: ['update:modelValue'],
        },
        Select: {
          template:
            '<select :id="id" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="o in normalizedOptions" :key="typeof o === \'string\' ? o : o.code" :value="typeof o === \'string\' ? o : o[optionValue || \'value\']">{{ typeof o === \'string\' ? o : o[optionLabel || \'label\'] }}</option></select>',
          props: ['modelValue', 'id', 'options', 'optionLabel', 'optionValue'],
          emits: ['update:modelValue'],
          computed: {
            normalizedOptions() {
              return (this as any).options || [];
            },
          },
        },
        Button: {
          template:
            '<button :disabled="disabled || loading" @click="$emit(\'click\')">{{ label }}</button>',
          props: ['label', 'disabled', 'loading'],
          emits: ['click'],
        },
        Skeleton: {
          template: '<div class="skeleton-stub" />',
        },
        Toast: {
          template: '<div />',
        },
        BottomSheet: {
          props: ['open', 'title'],
          emits: ['update:open'],
          template: '<div v-if="open" class="bottom-sheet-stub" :data-title="title"><slot /></div>',
        },
        MemberList: {
          props: ['members', 'currentUserId'],
          emits: ['remove', 'promote', 'demote'],
          template: `<div class="member-list-stub">
            <template v-for="m in members" :key="m.id">
              <button v-if="m.user_id !== currentUserId" class="remove-btn-stub" @click="$emit('remove', m)">Remove {{ m.id }}</button>
              <button v-if="m.role === 'member'" class="promote-btn-stub" @click="$emit('promote', m)">Promote {{ m.id }}</button>
              <button v-if="m.role === 'admin'" class="demote-btn-stub" @click="$emit('demote', m)">Demote {{ m.id }}</button>
            </template>
          </div>`,
        },
      },
    },
  });
}

describe('HouseholdSettingsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockGetOne.mockReset();
    mockGetOne.mockResolvedValue({ ...MOCK_HOUSEHOLD });
    mockGetFullList.mockReset();
    mockGetFullList.mockResolvedValue([...MOCK_MEMBERS]);
    // Default: no existing invite (404) - handleInviteOpen falls through to create
    mockGetFirstListItem.mockReset();
    mockGetFirstListItem.mockRejectedValue({ status: 404 });
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue({ ...MOCK_HOUSEHOLD });
    mockUpdateMember.mockReset();
    mockUpdateMember.mockResolvedValue({});
    mockSend.mockReset();
    mockLoadMembership.mockReset();
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({
      id: 'invite-1',
      token: 'abc123testtoken456789012345678901',
      household_id: 'hh-test',
    });
    mockDelete.mockReset();
    mockDelete.mockResolvedValue(undefined);
    mockToastAdd.mockReset();
    mockPopulate.mockReset();
    mockRouterBack.mockReset();
    mockRouterPush.mockReset();
  });

  it('renders loading skeletons before fetch completes', () => {
    mockGetOne.mockReturnValue(new Promise(() => {}));
    const wrapper = mountView();
    expect(wrapper.findAll('.skeleton-stub').length).toBeGreaterThan(0);
  });

  it('renders 3 section labels after fetch: HOUSEHOLD, FINANCES, FOOD', async () => {
    const wrapper = mountView();
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('HOUSEHOLD');
    expect(text).toContain('FINANCES');
    expect(text).toContain('FOOD');
  });

  it('pre-fills household name input from fetched data', async () => {
    const wrapper = mountView();
    await flushPromises();
    const nameInput = wrapper.find('#household-name');
    expect(nameInput.exists()).toBe(true);
    expect((nameInput.element as HTMLInputElement).value).toBe('Test Household');
  });

  it('Save button is disabled on initial render (no changes yet)', async () => {
    const wrapper = mountView();
    await flushPromises();
    const btn = wrapper.find('button[disabled]');
    // The Save button is the last button; it should be disabled because no changes
    expect(wrapper.text()).toContain('Save Changes');
    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Save Changes'));
    expect(saveBtn?.attributes('disabled')).toBeDefined();
  });

  it('Save button is enabled after changing household name', async () => {
    const wrapper = mountView();
    await flushPromises();
    await wrapper.find('#household-name').setValue('New Name');
    await wrapper.vm.$nextTick();
    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Save Changes'));
    expect(saveBtn?.attributes('disabled')).toBeUndefined();
  });

  it('Save button is disabled when split ratio sum ≠ 100', async () => {
    mockGetOne.mockResolvedValue({
      ...MOCK_HOUSEHOLD,
      split_ratios: { 'member-1': 70, 'member-2': 40 },
    });
    const wrapper = mountView();
    await flushPromises();
    // Sum is 110; even after changing name, Save should be disabled
    await wrapper.find('#household-name').setValue('New Name');
    await wrapper.vm.$nextTick();
    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Save Changes'));
    expect(saveBtn?.attributes('disabled')).toBeDefined();
  });

  it('calls pb.collection("households").update() with correct payload on save', async () => {
    const wrapper = mountView();
    await flushPromises();
    await wrapper.find('#household-name').setValue('Updated Name');
    await wrapper.vm.$nextTick();
    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Save Changes'));
    await saveBtn!.trigger('click');
    await flushPromises();
    expect(mockUpdate).toHaveBeenCalledWith(
      'hh-test',
      expect.objectContaining({
        name: 'Updated Name',
        currency: 'EUR',
        reminder_day: 'Monday',
      })
    );
  });

  it('calls householdStore.populate() after successful save', async () => {
    mockUpdate.mockResolvedValue({ ...MOCK_HOUSEHOLD, name: 'Updated Name' });
    const wrapper = mountView();
    await flushPromises();
    await wrapper.find('#household-name').setValue('Updated Name');
    await wrapper.vm.$nextTick();
    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Save Changes'));
    await saveBtn!.trigger('click');
    await flushPromises();
    expect(mockPopulate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'hh-test',
        name: 'Updated Name',
      })
    );
  });

  it('shows success Toast on save success', async () => {
    const wrapper = mountView();
    await flushPromises();
    await wrapper.find('#household-name').setValue('Updated Name');
    await wrapper.vm.$nextTick();
    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Save Changes'));
    await saveBtn!.trigger('click');
    await flushPromises();
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Household preferences saved',
      })
    );
  });

  it('shows error Toast on save failure and preserves form state', async () => {
    mockUpdate.mockRejectedValue(new Error('Network error'));
    const wrapper = mountView();
    await flushPromises();
    await wrapper.find('#household-name').setValue('Updated Name');
    await wrapper.vm.$nextTick();
    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Save Changes'));
    await saveBtn!.trigger('click');
    await flushPromises();
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: "Couldn't save - try again",
      })
    );
    // Form state preserved - name still shows the updated value
    const nameInput = wrapper.find('#household-name');
    expect((nameInput.element as HTMLInputElement).value).toBe('Updated Name');
  });

  it('shows household name inline error on blur when empty', async () => {
    const wrapper = mountView();
    await flushPromises();
    const nameInput = wrapper.find('#household-name');
    await nameInput.setValue('');
    await nameInput.trigger('blur');
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Household name is required');
  });

  it('shows error state with retry button when fetch fails', async () => {
    mockGetOne.mockRejectedValue(new Error('Network error'));
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("Couldn't load settings");
    expect(wrapper.find('.retry-btn').exists()).toBe(true);
  });

  // --- MEMBERS section ---

  it('renders MEMBERS section label after fetch success', async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain('MEMBERS');
  });

  it('renders MemberList stub when fetchStatus === success', async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.find('.member-list-stub').exists()).toBe(true);
  });

  it('"Invite member" button is visible after fetch', async () => {
    const wrapper = mountView();
    await flushPromises();
    const btn = wrapper.findAll('button').find((b) => b.text().includes('Invite member'));
    expect(btn?.exists()).toBe(true);
  });

  it('clicking "Invite member" calls pb.collection("invitations").create() with household_id', async () => {
    const wrapper = mountView();
    await flushPromises();
    const btn = wrapper.findAll('button').find((b) => b.text() === 'Invite member');
    await btn!.trigger('click');
    await flushPromises();
    expect(mockCreate).toHaveBeenCalledWith({ household_id: 'hh-test' });
  });

  it('opens invite sheet with the generated link after create succeeds', async () => {
    const wrapper = mountView();
    await flushPromises();
    const btn = wrapper.findAll('button').find((b) => b.text() === 'Invite member');
    await btn!.trigger('click');
    await flushPromises();
    expect(wrapper.find('.bottom-sheet-stub[data-title="Invite member"]').exists()).toBe(true);
    expect(wrapper.find('#invite-link').exists()).toBe(true);
    const input = wrapper.find('#invite-link').element as HTMLInputElement;
    expect(input.value).toContain('/invite/abc123testtoken456789012345678901');
  });

  it('reuses existing unaccepted invite instead of creating a new one', async () => {
    mockGetFirstListItem.mockResolvedValue({
      id: 'existing-invite',
      token: 'existingtoken12345678901234567890',
      household_id: 'hh-test',
    });
    const wrapper = mountView();
    await flushPromises();
    const btn = wrapper.findAll('button').find((b) => b.text() === 'Invite member');
    await btn!.trigger('click');
    await flushPromises();
    expect(mockCreate).not.toHaveBeenCalled();
    const input = wrapper.find('#invite-link').element as HTMLInputElement;
    expect(input.value).toContain('/invite/existingtoken12345678901234567890');
  });

  it('shows error Toast when invite create fails and does not open sheet', async () => {
    // getFirstListItem returns 404 (no existing invite) so it falls through to create
    mockGetFirstListItem.mockRejectedValue({ status: 404 });
    mockCreate.mockRejectedValue(new Error('Network error'));
    const wrapper = mountView();
    await flushPromises();
    const inviteBtn = wrapper.findAll('button').find((b) => b.text() === 'Invite member');
    await inviteBtn!.trigger('click');
    await flushPromises();
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: "Couldn't generate invite link - try again",
      })
    );
    expect(wrapper.find('.bottom-sheet-stub[data-title="Invite member"]').exists()).toBe(false);
  });

  it('@remove event from MemberList opens remove confirmation BottomSheet', async () => {
    const wrapper = mountView();
    await flushPromises();
    // member-2 is a non-admin member - remove is not blocked
    const removeButtons = wrapper.findAll('.remove-btn-stub');
    const member2RemoveBtn = removeButtons.find((b) => b.text().includes('member-2'));
    await member2RemoveBtn!.trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.bottom-sheet-stub[data-title="Remove member"]').exists()).toBe(true);
  });

  it('calls pb.collection("members").delete() with correct id on confirm', async () => {
    const wrapper = mountView();
    await flushPromises();
    const removeButtons = wrapper.findAll('.remove-btn-stub');
    const member2RemoveBtn = removeButtons.find((b) => b.text().includes('member-2'));
    await member2RemoveBtn!.trigger('click');
    await wrapper.vm.$nextTick();
    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === 'Remove');
    await confirmBtn!.trigger('click');
    await flushPromises();
    expect(mockDelete).toHaveBeenCalledWith('member-2');
  });

  it('calls loadSettings (getFullList) after successful removal', async () => {
    const wrapper = mountView();
    await flushPromises();
    const initialCallCount = mockGetFullList.mock.calls.length;
    const removeButtons = wrapper.findAll('.remove-btn-stub');
    const member2RemoveBtn = removeButtons.find((b) => b.text().includes('member-2'));
    await member2RemoveBtn!.trigger('click');
    await wrapper.vm.$nextTick();
    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === 'Remove');
    await confirmBtn!.trigger('click');
    await flushPromises();
    expect(mockGetFullList.mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  it('shows success Toast after member removal', async () => {
    const wrapper = mountView();
    await flushPromises();
    const removeButtons = wrapper.findAll('.remove-btn-stub');
    const member2RemoveBtn = removeButtons.find((b) => b.text().includes('member-2'));
    await member2RemoveBtn!.trigger('click');
    await wrapper.vm.$nextTick();
    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === 'Remove');
    await confirmBtn!.trigger('click');
    await flushPromises();
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Member removed',
      })
    );
  });

  it('shows error Toast when member delete fails', async () => {
    mockDelete.mockRejectedValue(new Error('Network error'));
    const wrapper = mountView();
    await flushPromises();
    const removeButtons = wrapper.findAll('.remove-btn-stub');
    const member2RemoveBtn = removeButtons.find((b) => b.text().includes('member-2'));
    await member2RemoveBtn!.trigger('click');
    await wrapper.vm.$nextTick();
    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === 'Remove');
    await confirmBtn!.trigger('click');
    await flushPromises();
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: "Couldn't remove member - try again",
      })
    );
  });

  // --- PROMOTE ---

  it('@promote event from MemberList opens promote confirmation BottomSheet', async () => {
    // MOCK_MEMBERS: member-2 has role='member' -> promote-btn-stub renders
    const wrapper = mountView();
    await flushPromises();
    const promoteBtn = wrapper.find('.promote-btn-stub');
    await promoteBtn.trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.bottom-sheet-stub[data-title="Promote to Admin"]').exists()).toBe(true);
  });

  it('confirms promote: calls pb.collection("members").update() with { role: "admin" }', async () => {
    const wrapper = mountView();
    await flushPromises();
    await wrapper.find('.promote-btn-stub').trigger('click');
    await wrapper.vm.$nextTick();
    const confirmBtn = wrapper.findAll('button').find((b) => b.text() === 'Promote');
    await confirmBtn!.trigger('click');
    await flushPromises();
    expect(mockUpdateMember).toHaveBeenCalledWith('member-2', { role: 'admin' });
  });

  it('shows success Toast after promote succeeds', async () => {
    const wrapper = mountView();
    await flushPromises();
    await wrapper.find('.promote-btn-stub').trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Promote')!
      .trigger('click');
    await flushPromises();
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('shows error Toast when promote fails', async () => {
    mockUpdateMember.mockRejectedValue(new Error('Network error'));
    const wrapper = mountView();
    await flushPromises();
    await wrapper.find('.promote-btn-stub').trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Promote')!
      .trigger('click');
    await flushPromises();
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  // --- DEMOTE ---

  it('@demote event from MemberList opens demote confirmation BottomSheet when 2 admins', async () => {
    // Override: 2 admins so demote is allowed
    mockGetFullList.mockResolvedValue([
      { ...MOCK_MEMBERS[0]!, user_id: 'user-other' }, // admin, not current user
      {
        id: 'member-self',
        household_id: 'hh-test',
        role: 'admin' as const,
        user_id: 'user-test',
        created: '',
        updated: '',
        expand: {
          user_id: { id: 'user-test', name: 'Helen', email: 'helen@test.com', avatar: '' },
        },
      },
    ]);
    const wrapper = mountView();
    await flushPromises();
    const demoteBtn = wrapper.find('.demote-btn-stub');
    await demoteBtn.trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.bottom-sheet-stub[data-title="Demote to Member"]').exists()).toBe(true);
  });

  it('confirms demote: calls pb.collection("members").update() with { role: "member" }', async () => {
    mockGetFullList.mockResolvedValue([
      { ...MOCK_MEMBERS[0]!, user_id: 'user-other', role: 'admin' as const },
      {
        id: 'member-self',
        household_id: 'hh-test',
        role: 'admin' as const,
        user_id: 'user-test',
        created: '',
        updated: '',
        expand: {
          user_id: { id: 'user-test', name: 'Helen', email: 'helen@test.com', avatar: '' },
        },
      },
    ]);
    const wrapper = mountView();
    await flushPromises();
    await wrapper.find('.demote-btn-stub').trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Demote')!
      .trigger('click');
    await flushPromises();
    expect(mockUpdateMember).toHaveBeenCalledWith(expect.any(String), { role: 'member' });
  });

  // --- LAST ADMIN BLOCK ---

  it('blocks demote-self when only 1 admin - shows inline error, no sheet opens', async () => {
    // Sole admin is current user (user-test)
    mockGetFullList.mockResolvedValue([
      {
        id: 'member-self',
        household_id: 'hh-test',
        role: 'admin' as const,
        user_id: 'user-test',
        created: '',
        updated: '',
        expand: {
          user_id: { id: 'user-test', name: 'Helen', email: 'helen@test.com', avatar: '' },
        },
      },
      { ...MOCK_MEMBERS[1]! },
    ]);
    const wrapper = mountView();
    await flushPromises();
    const demoteBtn = wrapper.find('.demote-btn-stub');
    await demoteBtn.trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.bottom-sheet-stub[data-title="Demote to Member"]').exists()).toBe(false);
    expect(wrapper.find('.last-admin-error').exists()).toBe(true);
    expect(wrapper.find('.last-admin-error').text()).toContain('At least one admin must remain');
  });

  it('blocks remove on last admin - shows inline error, no remove sheet opens', async () => {
    // MOCK_MEMBERS: member-1 (admin, user-1), member-2 (member)
    // adminCount === 1, member-1 role === 'admin' -> block remove on member-1
    const wrapper = mountView();
    await flushPromises();
    // remove-btn-stub for member-1 (admin) - first remove button
    const removeButtons = wrapper.findAll('.remove-btn-stub');
    await removeButtons[0]!.trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.bottom-sheet-stub[data-title="Remove member"]').exists()).toBe(false);
    expect(wrapper.find('.last-admin-error').exists()).toBe(true);
  });

  // --- DELETE HOUSEHOLD ---

  it('"Delete household" section NOT visible when multiple members', async () => {
    const wrapper = mountView();
    await flushPromises();
    // MOCK_MEMBERS has 2 members -> isSoleMember = false
    expect(wrapper.text()).not.toContain('Delete household');
  });

  it('"Delete household" section visible when sole member', async () => {
    mockGetFullList.mockResolvedValue([
      {
        id: 'member-self',
        household_id: 'hh-test',
        role: 'admin' as const,
        user_id: 'user-test',
        created: '',
        updated: '',
        expand: {
          user_id: { id: 'user-test', name: 'Helen', email: 'helen@test.com', avatar: '' },
        },
      },
    ]);
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain('Delete household');
  });

  it('clicking "Delete household" trigger button opens confirmation BottomSheet', async () => {
    mockGetFullList.mockResolvedValue([
      {
        id: 'member-self',
        household_id: 'hh-test',
        role: 'admin' as const,
        user_id: 'user-test',
        created: '',
        updated: '',
        expand: {
          user_id: { id: 'user-test', name: 'Helen', email: 'helen@test.com', avatar: '' },
        },
      },
    ]);
    const wrapper = mountView();
    await flushPromises();
    const deleteBtn = wrapper.findAll('button').find((b) => b.text() === 'Delete household');
    await deleteBtn!.trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.bottom-sheet-stub[data-title="Delete Household"]').exists()).toBe(true);
  });

  it('confirm delete calls pb.send with DELETE method', async () => {
    mockGetFullList.mockResolvedValue([
      {
        id: 'member-self',
        household_id: 'hh-test',
        role: 'admin' as const,
        user_id: 'user-test',
        created: '',
        updated: '',
        expand: {
          user_id: { id: 'user-test', name: 'Helen', email: 'helen@test.com', avatar: '' },
        },
      },
    ]);
    mockSend.mockResolvedValue({ message: 'Household deleted' });
    mockLoadMembership.mockResolvedValue(undefined);
    const wrapper = mountView();
    await flushPromises();
    // Open sheet by clicking trigger button
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Delete household')!
      .trigger('click');
    await wrapper.vm.$nextTick();
    // Click confirm button in sheet (last "Delete household" button)
    const allDeleteBtns = wrapper.findAll('button').filter((b) => b.text() === 'Delete household');
    await allDeleteBtns[allDeleteBtns.length - 1]!.trigger('click');
    await flushPromises();
    expect(mockSend).toHaveBeenCalledWith('/api/household', { method: 'DELETE' });
  });

  it('after delete success: calls authStore.loadMembership() and router.push("/setup")', async () => {
    mockGetFullList.mockResolvedValue([
      {
        id: 'member-self',
        household_id: 'hh-test',
        role: 'admin' as const,
        user_id: 'user-test',
        created: '',
        updated: '',
        expand: {
          user_id: { id: 'user-test', name: 'Helen', email: 'helen@test.com', avatar: '' },
        },
      },
    ]);
    mockSend.mockResolvedValue({});
    mockLoadMembership.mockResolvedValue(undefined);
    const wrapper = mountView();
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Delete household')!
      .trigger('click');
    await wrapper.vm.$nextTick();
    const allDeleteBtns = wrapper.findAll('button').filter((b) => b.text() === 'Delete household');
    await allDeleteBtns[allDeleteBtns.length - 1]!.trigger('click');
    await flushPromises();
    expect(mockLoadMembership).toHaveBeenCalled();
    expect(mockRouterPush).toHaveBeenCalledWith('/setup');
  });

  it('shows error Toast when delete fails', async () => {
    mockGetFullList.mockResolvedValue([
      {
        id: 'member-self',
        household_id: 'hh-test',
        role: 'admin' as const,
        user_id: 'user-test',
        created: '',
        updated: '',
        expand: {
          user_id: { id: 'user-test', name: 'Helen', email: 'helen@test.com', avatar: '' },
        },
      },
    ]);
    mockSend.mockRejectedValue(new Error('Server error'));
    const wrapper = mountView();
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Delete household')!
      .trigger('click');
    await wrapper.vm.$nextTick();
    const allDeleteBtns = wrapper.findAll('button').filter((b) => b.text() === 'Delete household');
    await allDeleteBtns[allDeleteBtns.length - 1]!.trigger('click');
    await flushPromises();
    expect(mockToastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });
});
