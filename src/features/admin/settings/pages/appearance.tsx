import { useState } from "react";
import { useAdmin } from "../../services/context";
import { Card, PageTitle, Button, Field } from "../../shared/ui/primitives";
export default function Appearance() {
  const runtime = useAdmin();
  const [error, setError] = useState("");
  return (
    <>
      <PageTitle title="Giao diện" description="Tùy chọn chỉ áp dụng cho không gian admin." />
      <Card>
        <Field label="Chế độ hiển thị">
          <div className="a-toolbar">
            {(["light", "dark", "system"] as const).map((mode, i) => (
              <Button
                key={mode}
                variant={runtime.theme === mode ? "primary" : "secondary"}
                aria-pressed={runtime.theme === mode}
                onClick={() => {
                  try {
                    runtime.setTheme(mode);
                    setError("");
                  } catch {
                    setError("Không lưu được tùy chọn trên trình duyệt.");
                  }
                }}
              >
                {["Sáng", "Tối", "Theo hệ thống"][i]}
              </Button>
            ))}
          </div>
        </Field>
        {error && <p role="alert">{error}</p>}
        <p>
          Font Inter, khoảng cách thoáng và chuyển động nhẹ; tự giảm chuyển động theo thiết lập
          thiết bị.
        </p>
      </Card>
    </>
  );
}
