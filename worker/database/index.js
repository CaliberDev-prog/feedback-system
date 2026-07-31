import { runMigrations } from './migrate.js';
import { seedDefaults } from './seed.js';

export async function initializeDatabase(env) {
  if (!env.DB) return;
  await runMigrations(env);
  await seedDefaults(env);
}
