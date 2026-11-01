import { AdminProvider } from "../services/context";
import { AdminLayout } from "./admin-layout";
import "../admin.css";
export function AdminEntry() {
  return (
    <AdminProvider>
      <AdminLayout />
    </AdminProvider>
  );
}
