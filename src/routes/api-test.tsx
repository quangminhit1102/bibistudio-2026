import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell, PageIntro } from "@/components/page-shell";
import { loadApiDemo } from "@/lib/api-demo";
import { t } from "@/lib/messages";

export const Route = createFileRoute("/api-test")({
  head: () => ({
    meta: [{ title: t("apiTest.metaTitle") }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ApiTestPage,
});
function ApiTestPage() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    loading: boolean;
    error?: string;
    data?: Awaited<ReturnType<typeof loadApiDemo>>;
  }>({ loading: true });
  const frontend = {
    releaseId: import.meta.env.VITE_BIBI_RELEASE_ID || "local",
    sourceSha: import.meta.env.VITE_BIBI_SOURCE_SHA || "local",
  };
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("API request timed out")), 10000);
    setState({ loading: true });
    loadApiDemo(controller.signal)
      .then((data) => setState({ loading: false, data }))
      .catch((error) => {
        if (
          !controller.signal.aborted ||
          controller.signal.reason?.message === "API request timed out"
        )
          setState({ loading: false, error: error.message || t("apiTest.unreachable") });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [attempt]);
  const matched =
    state.data?.backend.releaseId === frontend.releaseId &&
    state.data?.backend.sourceSha === frontend.sourceSha;
  return (
    <PageShell>
      <PageIntro
        eyebrow={t("apiTest.eyebrow")}
        title={t("apiTest.heading")}
        lead={t("apiTest.lead")}
      />
      <section className="mx-auto max-w-[1280px] px-5 pb-24 sm:px-6 lg:px-12">
        <div role="status" className="mb-6 rounded border border-border p-5">
          {state.loading
            ? t("apiTest.loading")
            : state.error
              ? t("apiTest.error", { error: state.error })
              : matched
                ? t("apiTest.matched")
                : t("apiTest.mismatched")}
        </div>
        <button
          className="mb-8 border border-border px-5 py-3 disabled:opacity-50"
          disabled={state.loading}
          onClick={() => setAttempt((n) => n + 1)}
        >
          {t("apiTest.retry")}
        </button>
        <div className="grid gap-6 md:grid-cols-2">
          {[
            { title: "Frontend", value: frontend },
            { title: "Backend", value: state.data?.backend ?? null },
          ].map((item) => (
            <div key={item.title} className="border border-border p-5">
              <h2 className="mb-3 font-display text-2xl">{item.title}</h2>
              <pre
                data-testid={item.title.toLowerCase() + "-version"}
                className="overflow-auto whitespace-pre-wrap break-all text-sm"
              >
                {JSON.stringify(item.value, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
