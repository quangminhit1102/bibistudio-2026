import { useState, type ReactNode } from "react";
import { Button, Card } from "../shared/ui/primitives";
import { componentLabel } from "./labels";
import { copyText } from "./clipboard";
export function Example({
  name,
  description,
  code,
  children,
}: {
  name: string;
  description: string;
  code: string;
  children: ReactNode;
}) {
  const [message, setMessage] = useState("");
  return (
    <Card className="a-example">
      <h2 data-component={name}>{componentLabel(name)}</h2>
      <p>{description}</p>
      <div className="a-example-preview">{children}</div>
      <details>
        <summary>TypeScript · cách sử dụng</summary>
        <pre>
          <code>{code}</code>
        </pre>
        <Button
          size="sm"
          onClick={async () => {
            try {
              await copyText(code);
              setMessage("Đã sao chép mã.");
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          Sao chép mã
        </Button>
        <small role="status">{message}</small>
      </details>
    </Card>
  );
}
