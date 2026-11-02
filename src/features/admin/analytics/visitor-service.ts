import type {
  AdminStore,
  DemoSession,
  ListInput,
  ListResult,
  VisitorSession,
} from "../services/contracts";
import { authorizeOperation } from "../accounts/permissions";
import { ensureDataset } from "../demo/registry";
import { createEntityService } from "../services/entity-service";
import { ServiceError } from "../services/errors";
import { getProduct } from "@/data/catalogue";
export function knownViewedProducts(sessions: VisitorSession[]): { slug: string; name: string }[] {
  const found = new Map<string, { slug: string; name: string }>();
  for (const session of sessions)
    for (const page of session.pages) {
      if (!page.path.startsWith("/") || page.path.startsWith("//")) continue;
      try {
        const path = new URL(page.path, "https://demo.invalid").pathname,
          match = path.match(/^\/products\/([^/]+)\/?$/);
        const p = match ? getProduct(decodeURIComponent(match[1])) : undefined;
        if (p) found.set(p.slug, { slug: p.slug, name: p.name.vi });
      } catch {
        /* Invalid historic paths do not identify a product. */
      }
    }
  return [...found.values()];
}
export async function listVisitorSessions(
  store: AdminStore,
  session: DemoSession | null,
  visitorId: string,
  input: ListInput,
): Promise<ListResult<VisitorSession> & { viewedProducts: { slug: string; name: string }[] }> {
  const active = await authorizeOperation(store, session, "analytics", "view");
  await ensureDataset(store, "visitors");
  if (!(await store.get("visitors", visitorId)))
    throw new ServiceError("not-found", "Không tìm thấy khách truy cập.");
  const result = await createEntityService(store, "sessions", () => session).list({
    ...input,
    filters: { ...input.filters, visitorId },
  });
  const sessions = (await store.list("sessions")).filter((s) => s.visitorId === visitorId);
  active();
  return { ...result, viewedProducts: knownViewedProducts(sessions) };
}
