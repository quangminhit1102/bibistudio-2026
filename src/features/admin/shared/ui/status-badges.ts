export type BadgeTone = "neutral" | "success" | "warning" | "error" | "info" | "privilege";
const tones: Record<string, Record<string, BadgeTone>> = {
  vat: { true: "info", false: "neutral" },
  account: {
    active: "success",
    inactive: "neutral",
    protected: "privilege",
    "full-access": "privilege",
  },
  customer: { active: "success", inactive: "neutral" },
  slip: { saved: "success", void: "error", pending: "warning", failed: "error" },
  product: { published: "success", draft: "neutral", archived: "neutral" },
  post: { published: "success", draft: "neutral" },
  stock: { low: "warning" },
};
export function statusBadgeTone(domain: string, state: string): BadgeTone {
  return Object.hasOwn(tones, domain) && Object.hasOwn(tones[domain], state)
    ? tones[domain][state]
    : "neutral";
}
