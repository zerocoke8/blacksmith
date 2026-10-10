import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build can be wrapped by Capacitor later.
  base: './',
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
  },
});
