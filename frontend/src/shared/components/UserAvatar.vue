<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { pb } from '@/shared/lib/pocketbase'

const props = withDefaults(defineProps<{ size?: number }>(), { size: 32 })

const AVATAR_COLORS = ['#c0705a', '#5a7dc0', '#5ac07d', '#c09f5a', '#9b5ac0']

const record = ref(pb.authStore.record)
const unsub = pb.authStore.onChange((_token, model) => {
  record.value = model
})
onUnmounted(unsub)

const avatarUrl = computed(() => {
  const r = record.value
  if (!r?.avatar) return null
  return pb.files.getURL(r, r.avatar as string)
})

const initial = computed(() => {
  const r = record.value
  const name = (((r as any)?.name || (r as any)?.username || (r as any)?.email || '?') as string)
  return name.charAt(0).toUpperCase()
})

const bgColor = computed(() => {
  const id = (record.value?.id as string | undefined) ?? ''
  const sum = [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!
})

const fontSize = computed(() => `${Math.round(props.size * 0.4375)}px`)
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
  >{{ initial }}</span>
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
