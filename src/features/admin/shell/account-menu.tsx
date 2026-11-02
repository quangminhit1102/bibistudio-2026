import { useNavigate } from "@tanstack/react-router";
import { useAdmin } from "../services/context";
import type { AdminUser } from "../services/contracts";
import { ProfileAvatar } from "../accounts/account-avatar";
import { roleNames } from "../accounts/permissions";
import { ActionMenu } from "../shared/ui/primitives";
import { ChevronsUpDown } from "lucide-react";
export function AccountMenu({ user, compact = false }: { user: AdminUser; compact?: boolean }) {
  const runtime = useAdmin(),
    navigate = useNavigate();
  return (
    <div className={`a-account-menu ${compact ? "a-account-compact" : ""}`}>
      <ActionMenu
        label={`Tài khoản ${user.name}`}
        trigger={
          <>
            <ProfileAvatar user={user} size={compact ? 32 : 36} />
            {!compact && (
              <span className="a-account-label">
                <strong>{user.name}</strong>
                <small>{roleNames[user.roleId] ?? user.roleId}</small>
              </span>
            )}
            {!compact && <ChevronsUpDown size={14} />}
          </>
        }
        items={[
          {
            label: "Hồ sơ",
            onSelect: () => void navigate({ to: "/admin/settings/profile" as "/admin" }),
          },
          { label: "Đăng xuất", onSelect: () => void runtime.logout() },
        ]}
      />
    </div>
  );
}
