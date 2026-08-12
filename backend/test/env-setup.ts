// Runs before AppModule (and therefore ConfigModule/PrismaService) is ever imported by a test file,
// so these values win over anything ConfigModule's dotenv load would otherwise apply. Points at a
// dedicated `expense_splitter_test` database (or the CI postgres service) — never the dev database.
process.env.DATABASE_URL ??=
  'postgresql://expense:expense@localhost:5433/expense_splitter_test?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'e2e-test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'e2e-test-refresh-secret';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.JWT_REFRESH_TTL_DAYS ??= '30';
process.env.FRONTEND_URL ??= 'http://localhost:5173';
