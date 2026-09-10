import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      SKIP_ENV_VALIDATION: 'true',
      JWT_SECRET: 'a79ac2ba570d36a582f78cef38871683e43decc445b8a874addfec02c3a43054',
      DATABASE_URL: 'postgresql://localhost/student_id_test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
