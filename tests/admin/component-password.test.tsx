import { it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormExample } from "../../src/features/admin/components/forms";
it("does not echo a password in the public value summary", () => {
  const view = render(<FormExample name="Password Input" />);
  fireEvent.change(view.container.querySelector("input")!, {
    target: { value: "NeverEchoThis2026" },
  });
  expect(screen.getByRole("status")).not.toHaveTextContent("NeverEchoThis2026");
  expect(view.container.querySelector("input")).toHaveAttribute("type", "password");
});
