/** Prisma `select` shape that excludes passwordHash — use for any query result exposed via the API. */
export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
} as const;
