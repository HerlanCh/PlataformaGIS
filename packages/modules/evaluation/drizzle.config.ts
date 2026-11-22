import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './adapters/schema.ts',
  out: './migrations',
});
