<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useUiStore } from '@/shared/stores/ui'
import AppNav from '@/shared/components/AppNav.vue'

const uiStore = useUiStore()
const route = useRoute()

uiStore.initTheme()
</script>

<template>
  <template v-if="route.meta.shellExcluded">
    <RouterView />
  </template>
  <AppNav v-else>
    <RouterView />
  </AppNav>
</template>
