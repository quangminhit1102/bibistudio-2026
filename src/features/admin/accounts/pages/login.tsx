import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "../../services/context";
import { roleNames } from "../permissions";
import { Button, Card, Field, ErrorState, Skeleton } from "../../shared/ui/primitives";
import { ArrowRight, Leaf } from "lucide-react";
export function DemoLogin() {
  const { store, ensure, login } = useAdmin();
  const [id, setId] = useState("user-1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const users = useQuery({
    queryKey: ["bibi-admin", "login-options"],
    queryFn: async () => {
      await ensure("users");
      return store.list("users");
    },
  });
  return (
    <div className="a-login">
      <div className="a-login-story">
        <Leaf size={30} />
        <p>BiBi Studio · Workspace</p>
        <h1>
          Một nơi gọn gàng.
          <br />
          Cho mọi ý tưởng lớn.
        </h1>
        <p>Catalogue, nội dung và công việc hằng ngày — kết nối trong một không gian.</p>
        <span>ADMIN DEMO / 2026</span>
      </div>
      <div className="a-login-form">
        <Card>
          <span className="a-wordmark">
            B<span>BiBi Admin</span>
          </span>
          <h2>Khám phá không gian quản trị</h2>
          <p>Chọn tài khoản mô phỏng để thử giao diện và phân quyền. Không cần mật khẩu.</p>
          {users.isPending ? (
            <Skeleton rows={2} />
          ) : users.error ? (
            <ErrorState error={users.error} onRetry={() => void users.refetch()} />
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await login(id);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Không thể vào demo");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Tài khoản demo">
                <select value={id} onChange={(e) => setId(e.target.value)}>
                  {users.data
                    ?.filter((u) => u.active)
                    .slice(0, 5)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {roleNames[u.roleId]}
                      </option>
                    ))}
                </select>
              </Field>
              {error && (
                <p className="a-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" loading={busy}>
                Vào không gian demo <ArrowRight size={16} />
              </Button>
            </form>
          )}
          <div className="a-demo-disclosure">
            Dữ liệu mô phỏng, lưu trong trình duyệt này. Đây không phải hệ thống đăng nhập
            production.
          </div>
        </Card>
      </div>
    </div>
  );
}
