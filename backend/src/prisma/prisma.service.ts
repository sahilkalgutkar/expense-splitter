import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // If you see "Calling client.query() when the client is already executing a query is
    // deprecated" in logs: it's Prisma 7's own query-interpreter (@prisma/client-engine-runtime)
    // mapping over a query plan's nodes on one reserved transactional connection - e.g. nested
    // writes like `expense.create({ data: { splits: { create: [...] } } })`, or an array-form
    // $transaction([...]) - not anything in this app's own Prisma calls. It's harmless today:
    // pg@8's Client queues overlapping .query() calls and sends them to Postgres strictly one at
    // a time (node_modules/pg/lib/client.js, `_queryQueue`), so results stay correctly ordered.
    // It only becomes a real problem if pg ships a v9 that drops that auto-queueing - the `^8.x`
    // range on the `pg` dependency already blocks that from happening silently. No stable Prisma
    // release beyond the one pinned here fixes the underlying interpreter behavior yet.
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
