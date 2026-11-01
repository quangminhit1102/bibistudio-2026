import { seedBase, DEMO_NOW } from "../demo/clock";
import type { SeedBatch } from "../demo/registry";
export function seed(): SeedBatch {
  const sessions = Array.from({ length: 200 }, (_, i) => {
    const start = new Date(
      Date.parse(DEMO_NOW) - (i % 30) * 86400000 - (i % 24) * 3600000 - 180000,
    ).toISOString();
    const pages = Array.from({ length: 1 + (i % 5) }, (_, j) => ({
      path: ["/", "/products", "/collections/explore-vietnam", "/blog", "/contact"][j],
      at: new Date(Date.parse(start) + j * 30000).toISOString(),
    }));
    return {
      ...seedBase(`session-${i + 1}`, i % 30),
      visitorId: `visitor-${(i % 80) + 1}`,
      startedAt: start,
      endedAt: i === 0 ? null : new Date(Date.parse(start) + pages.length * 30000).toISOString(),
      landingPage: "/",
      exitPage: pages.at(-1)!.path,
      referrer: ["Trực tiếp", "Google", "Facebook", "Instagram"][i % 4],
      pages,
    };
  });
  return {
    sessions,
    visitors: Array.from({ length: 80 }, (_, i) => {
      const own = sessions
        .filter((s) => s.visitorId === `visitor-${i + 1}`)
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
      return {
        ...seedBase(`visitor-${i + 1}`),
        anonymousId: `demo-visitor-${String(i + 1).padStart(3, "0")}`,
        ipAddress: `192.0.2.${i + 1}`.replace(/\.\d+$/, ".***"),
        country: ["Việt Nam", "Nhật Bản", "Hoa Kỳ"][i % 3],
        city: ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng"][i % 3],
        deviceType: ["Mobile", "Desktop", "Tablet"][i % 3],
        browser: ["Chrome", "Safari", "Edge"][i % 3],
        operatingSystem: ["Android", "Windows", "iOS"][i % 3],
        firstSeenAt: own[0].startedAt,
        lastSeenAt: own.at(-1)!.startedAt,
        sessionCount: own.length,
        pageViewCount: own.reduce((n, s) => n + s.pages.length, 0),
      };
    }),
  };
}
