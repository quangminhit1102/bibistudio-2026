import { resolveVisitorWindow } from "../../../../backend/src/visitors/date-window";
export interface VisitorFilterState {
  preset: "1m" | "6m" | "1y" | "custom";
  from?: string;
  to?: string;
}
export interface VisitorDates {
  from: string;
  to: string;
}
export function resolveFilterDates(state: VisitorFilterState, now = new Date()): VisitorDates {
  const window = resolveVisitorWindow(
    state.preset === "custom"
      ? { from: state.from ?? "", to: state.to ?? "" }
      : { preset: state.preset },
    now,
  );
  return { from: window.fromDate, to: window.toDate };
}
