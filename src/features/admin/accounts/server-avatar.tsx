import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "../services/context";
import { createProfileApi } from "./profile-api";
import type { PrincipalDto } from "../../../../backend/src/http/contracts";
export function ServerAvatar({
  user,
  size = 36,
  targetId,
}: {
  user: Pick<PrincipalDto, "id" | "displayName" | "avatarId">;
  size?: number;
  targetId?: string;
}) {
  const runtime = useAdmin(),
    identity = runtime.session?.userId;
  const query = useQuery({
    queryKey: ["bibi-admin", "avatar", identity, user.id, user.avatarId],
    enabled: !!identity && !!user.avatarId && !!runtime.http,
    queryFn: ({ signal }) =>
      createProfileApi(
        runtime.http!,
        targetId ?? (identity === user.id ? undefined : user.id),
      ).avatarBlob(user.avatarId!, signal),
    staleTime: Infinity,
    retry: false,
  });
  const [image, setImage] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!query.data) return;
    const url = URL.createObjectURL(query.data);
    setImage({ blob: query.data, url });
    return () => URL.revokeObjectURL(url);
  }, [query.data, identity, user.id, user.avatarId]);
  const src = image && image.blob === query.data && query.data ? image.url : undefined;
  return (
    <span
      className="a-server-avatar"
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        borderRadius: "50%",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--a-hover, #f4f4f5)",
        color: "var(--a-text, #18181b)",
        fontSize: Math.max(12, Math.round(size * 0.32)),
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={user.displayName}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span aria-label={`Ảnh đại diện ${user.displayName}`}>
          {user.displayName
            .trim()
            .split(/\s+/)
            .slice(-2)
            .map((p) => p[0])
            .join("")
            .toUpperCase()}
        </span>
      )}
    </span>
  );
}
