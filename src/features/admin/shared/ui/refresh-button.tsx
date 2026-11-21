import { RotateCw } from "lucide-react";
import { Button } from "./primitives";
import type { ComponentProps } from "react";

export function RefreshButton({
  loading = false,
  disabled,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      disabled={disabled || loading}
      className={`a-refresh-button ${props.className ?? ""}`}
      aria-busy={loading}
    >
      <RotateCw size={18} aria-hidden="true" className={loading ? "a-spin" : undefined} />
      Làm mới
    </Button>
  );
}
