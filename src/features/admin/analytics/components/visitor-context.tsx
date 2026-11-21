import type {
  VisitorContextFields,
  VisitorIpStatus,
} from "../../../../../backend/src/http/contracts";
import { Badge } from "../../shared/ui/primitives";
type Context = VisitorContextFields & {
  ipStatus?: VisitorIpStatus;
  ipAddress?: string;
  country?: string | null;
  city?: string | null;
};
export function VisitorIp({ value }: { value: Context }) {
  const known = ["observed", "verified"].includes(value.ipStatus ?? "") && !!value.ipAddress;
  return (
    <span className="a-visitor-context">
      <span className="a-visitor-ip">{known ? value.ipAddress : "Chưa xác định"}</span>
      {known && value.ipStatus === "observed" && <Badge tone="warning">Chưa xác minh</Badge>}
    </span>
  );
}
export function VisitorLocation({ value }: { value: Context }) {
  let name = value.country;
  try {
    if (name && value.countryCode)
      name = new Intl.DisplayNames(["vi"], { type: "region" }).of(value.countryCode) ?? name;
  } catch {
    /* Keep the dataset name if localization is unavailable. */
  }
  return (
    <span className="a-visitor-context">
      <span>{name || "Chưa xác định"}</span>
      {name && <Badge tone="info">Ước lượng</Badge>}
    </span>
  );
}
export function VisitorGeoAttribution() {
  return (
    <p className="a-muted a-visitor-footnote">
      <em>
        IP do website ghi nhận; quốc gia ước lượng theo{" "}
        <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer">
          DB-IP
        </a>
        .
      </em>
    </p>
  );
}
