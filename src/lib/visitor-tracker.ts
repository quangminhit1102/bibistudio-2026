import type { CollectBatch } from "../../backend/src/http/contracts";

interface TrackerOptions {
  catalogue: {
    routes: { path: string; label: string }[];
    products: { slug: string; name: string }[];
  };
  send: (batch: CollectBatch, options: { keepalive: boolean }) => Promise<{ status: number }>;
  clear?: () => Promise<unknown>;
  privacy: () => boolean;
  clock?: () => number;
  bootstrapLock?: <T>(work: () => Promise<T>) => Promise<T>;
}
/** Anonymous, bounded route interests only. No authentication or admin imports. */
export function createVisitorTracker(options: TrackerOptions) {
  const routes = new Set(options.catalogue.routes.map((route) => route.path));
  const products = new Set(options.catalogue.products.map((product) => product.slug));
  const paths = new Map<string, number>();
  const interests = new Map<string, number>();
  const now = options.clock ?? Date.now;
  const lock = options.bootstrapLock ?? (async <T>(work: () => Promise<T>) => work());
  let enabled = true,
    disposed = false,
    stopped = false;
  let sequence = 0,
    epoch = 0,
    bootstrapAttempts = 0,
    failures = 0;
  let lastPath = "/",
    lastSent = -Infinity,
    hiddenSequence = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  const allowed = () => !disposed && enabled && !stopped && options.privacy();
  function cancelTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function schedule() {
    if (!allowed() || !paths.size || timer !== undefined || inFlight) return;
    timer = setTimeout(
      () => {
        timer = undefined;
        void flush("timer");
      },
      Math.max(15000, 15000 - (now() - lastSent)),
    );
  }
  function visit(value: string) {
    if (!allowed()) return;
    const path = value.split(/[?#]/, 1)[0];
    if (!routes.has(path) || /^\/(admin|api|auth)(\/|$)/.test(path)) return;
    const ticket = ++sequence;
    if (paths.has(path) || paths.size < 200) paths.set(path, ticket);
    const slug = path.startsWith("/products/") ? path.slice(10) : "";
    if (products.has(slug) && (interests.has(slug) || interests.size < 100))
      interests.set(slug, ticket);
    lastPath = path;
    schedule();
  }
  function flush(reason: "timer" | "pagehide" = "timer"): Promise<void> {
    if (!allowed() || !paths.size || inFlight) return inFlight ?? Promise.resolve();
    if (reason === "pagehide") {
      if (hiddenSequence === sequence) return Promise.resolve();
      hiddenSequence = sequence;
    } else if (now() - lastSent < 15000) {
      schedule();
      return Promise.resolve();
    }
    cancelTimer();
    const selectedPaths = [...paths.entries()].slice(0, 50);
    const selectedProducts = [...interests.entries()].slice(0, 50);
    const batch = (): CollectBatch => ({
      paths: selectedPaths.map(([path]) => path),
      products: selectedProducts.map(([slug]) => slug),
      lastPath,
    });
    while (new TextEncoder().encode(JSON.stringify(batch())).length > 15000) {
      if (selectedProducts.length > selectedPaths.length) selectedProducts.pop();
      else if (selectedPaths.length > 1) selectedPaths.pop();
      else selectedProducts.pop();
    }
    const payload = batch(),
      ticket = epoch;
    lastSent = now();
    inFlight = (async () => {
      try {
        const response = await lock(() =>
          epoch === ticket && allowed()
            ? options.send(payload, { keepalive: reason === "pagehide" })
            : Promise.resolve({ status: 204 }),
        );
        if (epoch !== ticket || disposed) return;
        if (response.status === 204) {
          for (const [path, version] of selectedPaths)
            if (paths.get(path) === version) paths.delete(path);
          for (const [slug, version] of selectedProducts)
            if (interests.get(slug) === version) interests.delete(slug);
          bootstrapAttempts = 0;
          failures = 0;
        } else if (response.status === 202) {
          if (++bootstrapAttempts >= 2) stopped = true;
        } else if ([429, 503, 502, 504].includes(response.status)) {
          if (++failures > 2) stopped = true;
        } else stopped = true;
      } catch {
        if (epoch === ticket && ++failures > 2) stopped = true;
      } finally {
        inFlight = undefined;
        if (stopped) {
          paths.clear();
          interests.clear();
        }
        schedule();
      }
    })();
    return inFlight;
  }
  async function setEnabled(value: boolean) {
    enabled = value;
    epoch++;
    cancelTimer();
    paths.clear();
    interests.clear();
    stopped = false;
    failures = 0;
    bootstrapAttempts = 0;
    if (!value) {
      await inFlight;
      if (options.clear)
        try {
          await lock(options.clear);
        } catch {
          /* Local opt-out remains effective. */
        }
    }
  }
  function dispose() {
    disposed = true;
    epoch++;
    cancelTimer();
    paths.clear();
    interests.clear();
  }
  return { visit, flush, setEnabled, dispose };
}
export type VisitorTracker = ReturnType<typeof createVisitorTracker>;
