import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { t } from "@/lib/messages";
import { site } from "@/platform/site";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { FloatingContact } from "../components/floating-contact";
import { isAdminPath } from "../lib/admin-boundary";
import { VisitorTracking } from "../components/visitor-tracking";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("notFound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("notFound.text")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("error.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.text")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("error.retry")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: site.name },
      { name: "author", content: site.name },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      ...(site.preconnect ?? []).map(({ href, crossOrigin }) => ({
        rel: "preconnect",
        href,
        ...(crossOrigin ? { crossOrigin: "anonymous" as const } : {}),
      })),
      ...site.fonts.map(({ href }) => ({ rel: "stylesheet", href })),
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  if (import.meta.env.VITE_BIBI_CSR === "true") {
    return (
      <>
        <HeadContent />
        {children}
      </>
    );
  }
  return (
    <html lang={site.defaultLocale}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Images fade in from the paper background once loaded (skips cached/already-complete ones).
function ImageFade() {
  useEffect(() => {
    const mark = (img: HTMLImageElement) => {
      if (img.dataset.fade) return;
      img.dataset.fade = "1";
      if (img.complete && img.naturalWidth) return;
      img.classList.add("img-loading");
      const done = () => img.classList.remove("img-loading");
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    };
    document.querySelectorAll("img").forEach(mark);
    const mo = new MutationObserver((ms) =>
      ms.forEach((m) =>
        m.addedNodes.forEach((n) => {
          if (n instanceof HTMLImageElement) mark(n);
          else if (n instanceof HTMLElement) n.querySelectorAll("img").forEach(mark);
        }),
      ),
    );
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({
    select: (state) =>
      state.matches.every((match) => match.status === "success") ? state.location.pathname : "",
  });
  const admin = useRouterState({
    select: (state) =>
      isAdminPath(state.location.pathname, import.meta.env.VITE_ROUTER_BASEPATH || "/"),
  });

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <VisitorTracking pathname={pathname} />
      {!admin && <FloatingContact />}
      {!admin && <ImageFade />}
    </QueryClientProvider>
  );
}
