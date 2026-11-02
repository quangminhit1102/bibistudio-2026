import baseline from "./legacy-presentation.json";
import type { EntityKey } from "../services/contracts";
export function legacyPresentationBaseline(
  entity: EntityKey,
  id: string,
): Readonly<Record<string, unknown>> | undefined {
  if (entity === "notifications" && /^notification-[1-8]$/.test(id)) {
    const i = Number(id.split("-")[1]) - 1;
    return {
      name: [
        "Chào mừng đến BiBi Admin",
        "Kiểm tra sản phẩm đang nháp",
        "Báo cáo demo đã sẵn sàng",
        "Cập nhật thông tin hồ sơ",
      ][i % 4],
      description: "Thông báo mô phỏng, không kết nối dữ liệu production.",
    };
  }
  if (entity === "roles") {
    const names: Record<string, string> = {
      "super-admin": "Super Admin",
      administrator: "Administrator",
      manager: "Manager",
      editor: "Editor",
      viewer: "Viewer",
    };
    return names[id] ? { name: names[id] } : undefined;
  }
  return (baseline as Record<string, Record<string, Record<string, unknown>>>)[entity]?.[id];
}
