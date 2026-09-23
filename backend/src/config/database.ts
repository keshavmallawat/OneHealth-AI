/**
 * Single shared PrismaClient.
 *
 * Two things are deliberate here:
 *
 *  1. One client for the whole process. Instantiating PrismaClient per module
 *     opens a new connection pool each time; the global cache also survives
 *     nodemon's re-imports in development.
 *
 *  2. A `pg` driver adapter. Combined with `engineType = "client"` in
 *     schema.prisma this removes Prisma's native query engine entirely — the
 *     runtime is plain JavaScript talking to PostgreSQL over `pg`. That is why
 *     the project starts on a machine that has never downloaded a Prisma
 *     engine binary, which is exactly the failure mode that eats demo time.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __onehealthPrisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.isProduction ? ['error'] : ['error', 'warn'],
  });
}

export const prisma = global.__onehealthPrisma ?? createClient();

if (!env.isProduction) {
  global.__onehealthPrisma = prisma;
}

export async function assertDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
