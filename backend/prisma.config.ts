import 'dotenv/config';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-mongo/config';

export default definePrismaConfig({
  orm: ormConfig({
    contract: "./src/prisma/contract.prisma",
    db: {
      connection: (globalThis as typeof globalThis & {
        process: { env: Record<string, string | undefined> };
      }).process.env.MONGODB_URI,
    },
  }),
});
