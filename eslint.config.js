// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      '.expo/*',
      // Deno runtime (Supabase Edge Functions): import specifiers are https://
      // URLs and the globals are Deno's, so the React Native lint rules and the
      // resolver do not apply. Checked by `supabase functions deploy` instead.
      'supabase/functions/**',
    ],
  },
]);
