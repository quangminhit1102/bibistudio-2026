import { useNavigate } from "@tanstack/react-router";
import { useAdmin } from "../services/context";
import type { AdminUser } from "../services/contracts";
import { ProfileAvatar } from "../accounts/account-avatar";
import { roleNames } from "../accounts/permissions";
import { ActionMenu } from "../shared/ui/primitives";
import { ChevronsUpDown } from "lucide-react";
import type { PrincipalDto } from "../../../../backend/src/http/contracts";
import { can } from "../accounts/permissions";
export function AccountMenu({
  user,
  compact = false,
}: {
  user: AdminUser | PrincipalDto;
  compact?: boolean;
}) {
  const runtime = useAdmin(),
    navigate = useNavigate();
  const server = "displayName" in user;
  const name = server ? user.displayName : user.name;
  const role = server
    ? user.roles.map((item) => item.name).join(", ")
    : (roleNames[user.roleId] ?? user.roleId);
  const showProfile = runtime.session?.kind !== "http" || can(runtime.session, "accounts", "view");
  return (
    <div className={`a-account-menu ${compact ? "a-account-compact" : ""}`}>
      <ActionMenu
        label={`Tài khoản ${name}`}
        trigger={
          <>
            <ProfileAvatar user={server ? { id: user.id, name } : user} size={compact ? 32 : 36} />
            {!compact && (
              <span className="a-account-label">
                <strong>{name}</strong>
                <small>{role || "Chưa có vai trò"}</small>
              </span>
            )}
            {!compact && <ChevronsUpDown size={14} />}
          </>
        }
        items={[
          ...(showProfile
            ? [
                {
                  label: "Hồ sơ",
                  onSelect: () => void navigate({ to: "/admin/settings/profile" as "/admin" }),
                },
              ]
            : []),
          { label: "Đăng xuất", onSelect: () => void runtime.logout() },
        ]}
      />
    </div>
  );
}
