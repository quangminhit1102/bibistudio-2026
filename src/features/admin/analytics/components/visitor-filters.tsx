import { useState } from "react";
import { Button } from "../../shared/ui/primitives";
import {
  resolveFilterDates,
  type VisitorDates,
  type VisitorFilterState,
} from "../visitor-date-filter";

export function VisitorFilters({
  dates,
  onApply,
}: {
  dates: VisitorDates;
  onApply: (dates: VisitorDates) => void;
}) {
  const [draft, setDraft] = useState<VisitorFilterState>({ preset: "1m", ...dates });
  let valid: VisitorDates | null = null;
  try {
    valid = resolveFilterDates(draft);
  } catch {
    /* Invalid draft is not applied. */
  }
  return (
    <div className="a-visitor-date-filter">
      <div className="a-actions" role="group" aria-label="Khoảng thời gian">
        {(
          [
            ["1m", "1 tháng"],
            ["6m", "6 tháng"],
            ["1y", "1 năm"],
            ["custom", "Khoảng ngày"],
          ] as const
        ).map(([preset, label]) => (
          <Button
            key={preset}
            aria-pressed={draft.preset === preset}
            variant={draft.preset === preset ? "secondary" : "ghost"}
            onClick={() => {
              const next = { ...dates, preset };
              setDraft(next);
              if (preset !== "custom") onApply(resolveFilterDates(next));
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {draft.preset === "custom" && (
        <div className="a-visitor-custom-dates">
          <label>
            Từ ngày
            <input
              type="date"
              min="1970-01-01"
              max="9999-12-31"
              value={draft.from ?? ""}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              min="1970-01-01"
              max="9999-12-31"
              value={draft.to ?? ""}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </label>
          <Button
            disabled={!valid}
            onClick={() => {
              if (valid) onApply(valid);
            }}
          >
            Áp dụng
          </Button>
          {!valid && (
            <span role="status" className="a-muted">
              Chọn ngày bắt đầu không sau ngày kết thúc.
            </span>
          )}
        </div>
      )}
      <p className="a-muted a-visitor-date-note">
        <em>
          Từ {dates.from.split("-").reverse().join("/")} đến hết ngày{" "}
          {dates.to.split("-").reverse().join("/")} · giờ Việt Nam. Một phiên mới bắt đầu sau hơn 30
          phút không hoạt động.
        </em>
      </p>
    </div>
  );
}
