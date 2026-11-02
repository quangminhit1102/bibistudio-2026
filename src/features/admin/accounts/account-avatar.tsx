import { useEffect, useState } from "react";
import type { AdminUser } from "../services/contracts";
import { useAdmin } from "../services/context";
import { ownedAvatarKey } from "./profile-avatar";
export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "B") + (parts.length > 1 ? parts.at(-1)![0] : "");
}
export function ProfileAvatar({ user, size = 36 }: { user: AdminUser; size?: number }) {
  const { store, session } = useAdmin();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const key = user.avatar?.blobKey;
  useEffect(() => {
    let active = true,
      url: string | undefined;
    setSrc(null);
    setFailed(false);
    if (user.id === session?.userId && ownedAvatarKey(user.id, key))
      void store
        .getBlob(key)
        .then((blob) => {
          if (!active || !blob) return;
          url = URL.createObjectURL(blob);
          setSrc(url);
        })
        .catch(() => {});
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [store, session?.userId, user.id, key]);
  return (
    <span
      className="a-avatar a-profile-avatar"
      style={{ width: size, height: size, flexShrink: 0 }}
      role="img"
      aria-label={`Ảnh đại diện ${user.name}`}
    >
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        profileInitials(user.name)
      )}
    </span>
  );
}
