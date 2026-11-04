import { useState } from "react";
import { useAdmin } from "../../services/context";
import { Button, Card, Field } from "../../shared/ui/primitives";
import { Leaf, Eye, EyeOff, ArrowRight } from "lucide-react";
export function Login() {
  const { login, authNotice } = useAdmin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="a-login">
      <div className="a-login-story">
        <Leaf size={30} />
        <p>BiBi Studio · Không gian quản trị</p>
        <h1>
          Một nơi gọn gàng.
          <br />
          Cho mọi ý tưởng lớn.
        </h1>
        <p>Sản phẩm, nội dung và công việc hằng ngày — kết nối trong một không gian.</p>
      </div>
      <div className="a-login-form">
        <Card>
          <span className="a-wordmark">
            B<span>BiBi Admin</span>
          </span>
          <h2>Chào mừng trở lại</h2>
          <p>Đăng nhập để quản lý công việc của bạn.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                await login({ username, password });
              } catch (e) {
                setError(e instanceof Error ? e.message : "Không thể đăng nhập.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Tên tài khoản">
              <input
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field label="Mật khẩu">
              <span className="a-password-control">
                <input
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </span>
            </Field>
            {(error || authNotice) && (
              <p role="alert" className="a-error">
                {error || authNotice}
              </p>
            )}
            <Button type="submit" variant="primary" loading={busy}>
              Đăng nhập <ArrowRight size={16} />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
