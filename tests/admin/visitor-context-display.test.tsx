import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  VisitorIp,
  VisitorLocation,
  VisitorGeoAttribution,
} from "../../src/features/admin/analytics/components/visitor-context";
test("observed public IPv6 remains complete and is not described as verified", () => {
  const ip = "2606:4700:4700::1111";
  render(<VisitorIp value={{ ipStatus: "observed", ipAddress: ip, ipSource: "php_relay" }} />);
  expect(screen.getByText(ip)).toBeVisible();
  expect(screen.getByText("Chưa xác minh")).toBeVisible();
  expect(screen.queryByText("Đã xác minh")).not.toBeInTheDocument();
});
test("country is localized and explicitly estimated, with database attribution", () => {
  render(
    <>
      <VisitorLocation
        value={{
          country: "United States",
          countryCode: "US",
          countryDataset: "dbip-country-lite-2026-11",
        }}
      />
      <VisitorGeoAttribution />
    </>,
  );
  expect(screen.getByText("Hoa Kỳ")).toBeVisible();
  expect(screen.getByText("Ước lượng")).toBeVisible();
  expect(screen.getByRole("link", { name: "DB-IP" })).toHaveAttribute("href", "https://db-ip.com");
});
test("legacy masked prefix is never a full IP, missing country stays unknown", () => {
  render(
    <>
      <VisitorIp value={{ ipStatus: "legacy", ipAddress: "127.0.0.0/24" }} />
      <VisitorLocation value={{ country: null }} />
    </>,
  );
  expect(screen.getAllByText("Chưa xác định")).toHaveLength(2);
  expect(screen.queryByText("127.0.0.0/24")).not.toBeInTheDocument();
  expect(screen.queryByText("Ước lượng")).not.toBeInTheDocument();
});
