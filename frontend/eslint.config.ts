import pluginVue from 'eslint-plugin-vue';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';

export default defineConfigWithVueTs(
  { ignores: ['**/dist/**', '**/coverage/**', '*.d.ts', 'test-results/**'] },
  { files: ['**/*.{ts,vue}'] },
  pluginVue.configs['flat/strongly-recommended'],
  vueTsConfigs.recommended,
  {
    files: ['e2e/**/*.ts', '**/*.spec.ts', '**/*.test.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  skipFormatting
);
