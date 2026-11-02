import { it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";
import { navigation } from "../../src/features/admin/shell/navigation";
import { SidebarNavigation } from "../../src/features/admin/shell/sidebar-navigation";
it.each([
  ["/admin/content/posts/create", "Viết bài mới"],
  ["/admin/products/product-1/edit", "Danh sách sản phẩm"],
])("highlights only the intended link on %s with the real router", async (path, label) => {
  function Shell() {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    return (
      <SidebarNavigation
        groups={navigation}
        pathname={pathname}
        open={new Set(navigation.map((g) => g.id))}
        toggle={() => {}}
      />
    );
  }
  const root = createRootRoute({ component: Shell });
  const route = createRoute({ getParentRoute: () => root, path: path, component: () => null });
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole("link", { name: label, exact: true });
  await waitFor(() => expect(document.querySelectorAll('a[aria-current="page"]')).toHaveLength(1));
  expect(screen.getByRole("link", { name: label, exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
