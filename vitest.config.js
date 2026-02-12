/**
 * @file vitest.config.js
 * @author Marco De Luca
 * @date 2026-02-11
 * @description Vitest configuration for backend
 *              unit and integration tests.
 *
 * @update_history
 *   2026-02-11 - Initial creation
 */

import { defineConfig } from 'vitest/config';

export default defineConfig(
{
  test:
  {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{js,ts}'],
    coverage:
    {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['directus/extensions/**'],
    },
  },
});
