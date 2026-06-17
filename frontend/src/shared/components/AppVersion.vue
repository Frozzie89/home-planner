<script setup lang="ts">
const version = __APP_VERSION__;
</script>

<template>
  <p class="app-version">Version {{ version }}</p>
</template>

<style scoped>
.app-version {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-align: center;
  padding-top: var(--space-2);
}
</style>
