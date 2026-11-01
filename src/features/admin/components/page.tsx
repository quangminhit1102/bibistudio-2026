import { lazy, Suspense } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Card, PageTitle, Skeleton } from "../shared/ui/primitives";
import { componentCatalogue, type ComponentCategory } from "./catalogue";
const examples = {
  actions: lazy(() => import("./actions")),
  forms: lazy(() => import("./forms")),
  "data-display": lazy(() => import("./data-display")),
  navigation: lazy(() => import("./navigation")),
  overlays: lazy(() => import("./overlays")),
  feedback: lazy(() => import("./feedback")),
  charts: lazy(() => import("./charts")),
};
export default function ComponentPage() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const category = path.split("/").at(-1) as ComponentCategory;
  const View = examples[category];
  return (
    <>
      <PageTitle
        title="Thư viện thành phần"
        description="Các khối UI của BiBi Admin · ví dụ tương tác và TypeScript dùng lại."
      />
      <nav className="a-showcase-tabs" aria-label="Nhóm thành phần">
        {Object.keys(componentCatalogue).map((k) => (
          <Link
            className="a-btn"
            aria-current={category === k ? "page" : undefined}
            key={k}
            to={("/admin/components/" + k) as "/admin"}
          >
            {k}
          </Link>
        ))}
      </nav>
      {View ? (
        <div className="a-examples">
          <Suspense fallback={<Skeleton rows={6} />}>
            <View />
          </Suspense>
        </div>
      ) : (
        <div className="a-grid-2">
          {Object.entries(componentCatalogue).map(([key, items]) => (
            <Card key={key}>
              <h2>{key}</h2>
              <p>
                {items.length} ví dụ · {items.join(", ")}
              </p>
              <Link className="a-btn" to={("/admin/components/" + key) as "/admin"}>
                Khám phá {key}
              </Link>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
