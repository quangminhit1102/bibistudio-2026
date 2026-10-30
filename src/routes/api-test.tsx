import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell, PageIntro } from "@/components/page-shell";
import { loadApiDemo } from "@/lib/api-demo";

export const Route = createFileRoute("/api-test")({
  head: () => ({
    meta: [
      { title: "Kiểm tra API — BiBi Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
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
          setState({ loading: false, error: error.message || "Không kết nối được API" });
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
        eyebrow="KIỂM TRA KỸ THUẬT"
        title="Kết nối React và API"
        lead="Trang thử nghiệm công khai dành cho việc kiểm tra và phát hành BiBi Studio."
      />
      <section className="mx-auto max-w-[1280px] px-5 pb-24 sm:px-6 lg:px-12">
        <div role="status" className="mb-6 rounded border border-border p-5">
          {state.loading
            ? "Đang kết nối API…"
            : state.error
              ? `Lỗi kết nối: ${state.error}`
              : matched
                ? "Kết nối thành công — phiên bản FE và BE khớp nhau."
                : "Đã kết nối nhưng phiên bản FE và BE chưa khớp."}
        </div>
        <button
          className="mb-8 border border-border px-5 py-3 disabled:opacity-50"
          disabled={state.loading}
          onClick={() => setAttempt((n) => n + 1)}
        >
          Thử lại
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
        {state.data && (
          <pre className="mt-6 overflow-auto rounded bg-secondary p-5 text-sm">
            {JSON.stringify(state.data.demo, null, 2)}
          </pre>
        )}
      </section>
    </PageShell>
  );
}
