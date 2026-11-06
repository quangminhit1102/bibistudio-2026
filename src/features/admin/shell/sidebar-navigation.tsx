import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { activeNavigationItem, type NavigationGroup } from "./navigation";
import { Tooltip } from "../shared/ui/primitives";
export function SidebarNavigation({
  groups,
  pathname,
  open,
  toggle,
  collapsed = false,
}: {
  groups: NavigationGroup[];
  pathname: string;
  open: Set<string>;
  toggle: (id: string) => void;
  collapsed?: boolean;
}) {
  const instance = useId(),
    active = activeNavigationItem(groups, pathname);
  return (
    <nav aria-label="Điều hướng quản trị">
      {groups.map((group) => {
        const panel = instance + "-" + group.id;
        const expanded = open.has(group.id);
        return (
          <div className="a-nav-group" key={group.id}>
            <button
              type="button"
              id={panel + "-trigger"}
              className="a-nav-group-toggle"
              aria-expanded={expanded}
              aria-controls={panel}
              onClick={() => toggle(group.id)}
            >
              <span>{group.label}</span>
              <ChevronDown size={15} aria-hidden className={expanded ? "a-nav-chevron-open" : ""} />
            </button>
            <div
              id={panel}
              className="a-nav-panel"
              role="group"
              aria-labelledby={panel + "-trigger"}
              data-open={expanded}
            >
              {group.items.map((item) => (
                <Tooltip key={item.path} label={item.label} side="right" enabled={collapsed}>
                  <Link
                    to={item.path as "/admin"}
                    activeOptions={{ exact: true }}
                    title={collapsed ? undefined : item.label}
                    aria-label={item.label}
                    className={`a-nav-link ${active?.path === item.path ? "active" : ""}`}
                    aria-current={active?.path === item.path ? "page" : undefined}
                  >
                    <item.icon size={18} aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                </Tooltip>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
