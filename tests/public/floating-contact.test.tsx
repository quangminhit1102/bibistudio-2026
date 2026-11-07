import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
const route = vi.hoisted(() => ({ href: "/" }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: route }),
}));
import { FloatingContact } from "@/components/floating-contact";
import { contact } from "@/data/contact";

describe("compact public contact", () => {
  it("starts closed and opens four named channels with existing destinations", async () => {
    const user = userEvent.setup();
    render(<FloatingContact />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Liên hệ BiBi" }));
    expect(screen.getByRole("link", { name: /Gọi điện/ })).toHaveAttribute(
      "href",
      `tel:${contact.phone}`,
    );
    expect(screen.getByRole("link", { name: /Zalo/ })).toHaveAttribute("href", contact.zalo);
    expect(screen.getByRole("link", { name: /Facebook/ })).toHaveAttribute(
      "href",
      contact.facebook,
    );
    expect(screen.getByRole("link", { name: /Messenger/ })).toHaveAttribute(
      "href",
      contact.messenger,
    );
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });
  it("supports keyboard exploration and Escape returning focus", async () => {
    const user = userEvent.setup();
    render(<FloatingContact />);
    const trigger = screen.getByRole("button", { name: "Liên hệ BiBi" });
    trigger.focus();
    await user.keyboard("{Enter}{Tab}");
    expect(screen.getByRole("link", { name: /Gọi điện/ })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("dismisses outside without stealing focus and on overlays/navigation", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <>
        <button>Outside</button>
        <FloatingContact />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Liên hệ BiBi" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    fireEvent(window, new Event("bibi:public-overlay-open"));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    route.href = "/products";
    rerender(
      <>
        <button>Outside</button>
        <FloatingContact />
      </>,
    );
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    route.href = "/";
  });
});
