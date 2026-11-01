export const DEMO_NOW = "2026-11-01T00:00:00.000Z";
export const seedBase = (id: string, daysAgo = 0) => ({
  id,
  createdAt: new Date(Date.parse(DEMO_NOW) - daysAgo * 86400000).toISOString(),
  updatedAt: DEMO_NOW,
  revision: 1,
});
