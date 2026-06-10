<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  active: boolean
  otherMemberName: string
}>()

const announcement = ref('')

watch(() => props.active, (isActive) => {
  announcement.value = isActive ? `Balance settled with ${props.otherMemberName}` : ''
})
</script>

<template>
  <div aria-live="polite" class="sr-only">{{ announcement }}</div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
