<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { pb } from '@/shared/lib/pocketbase';

interface UserRecord {
  id: string;
  name?: string;
  username?: string;
  email?: string;
  avatar?: string;
}

const props = withDefaults(
  defineProps<{
    size?: number;
    userRecord?: UserRecord | null;
  }>(),
  { size: 32 }
);

const AVATAR_COLORS = ['#c0705a', '#5a7dc0', '#5ac07d', '#c09f5a', '#9b5ac0'];

const authRecord = ref(pb.authStore.record);
const unsub = pb.authStore.onChange((_token, model) => {
  authRecord.value = model;
});
onUnmounted(unsub);

const activeRecord = computed<UserRecord | null>(
  () => props.userRecord ?? (authRecord.value as UserRecord | null)
);

const avatarUrl = computed(() => {
  const r = activeRecord.value;
  if (!r?.avatar) return null;
  return pb.files.getURL(r as any, r.avatar);
});

const initial = computed(() => {
  const r = activeRecord.value;
  const name = r?.name || r?.username || r?.email || '?';
  return name.charAt(0).toUpperCase();
});

const bgColor = computed(() => {
  const id = activeRecord.value?.id ?? '';
  const sum = [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
});

const fontSize = computed(() => `${Math.round(props.size * 0.4375)}px`);
</script>

<template>
  <img
    v-if="avatarUrl"
    :src="avatarUrl"
    alt=""
    class="avatar-img"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  />
  <span
    v-else
    class="avatar-initial"
    :style="{ backgroundColor: bgColor, width: `${size}px`, height: `${size}px`, fontSize }"
    aria-hidden="true"
    >{{ initial }}</span
  >
</template>

<style scoped>
.avatar-img,
.avatar-initial {
  display: block;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.avatar-initial {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: #ffffff;
  user-select: none;
}
</style>
