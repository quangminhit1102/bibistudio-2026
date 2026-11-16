import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import type { AdminHttpClient } from "../../../lib/admin-http";
import type { DemoSession } from "../services/contracts";
import { canCode } from "../accounts/permissions";
import { createContentHttp } from "./http-api";
import type { ContentCapabilities, ContentHttpModule } from "./contracts";
export interface ContentRuntime {
  mode: "http" | "demo";
  api: ContentHttpModule | null;
  capabilities: ContentCapabilities | undefined;
  pending: boolean;
  error: Error | null;
  retry: () => void;
  can: (code: string) => boolean;
  subscribe?: () => () => void;
}
export const ContentContext = createContext<ContentRuntime | null>(null);
export function ContentProvider({
  children,
  http,
  session,
  mode,
}: {
  children: ReactNode;
  http?: AdminHttpClient;
  session: DemoSession | null;
  mode: "http" | "demo";
}) {
  const [consumers, setConsumers] = useState(0),
    subscribe = useCallback(() => {
      setConsumers((count) => count + 1);
      return () => setConsumers((count) => Math.max(0, count - 1));
    }, []);
  const api = useMemo(() => (http ? createContentHttp(http) : null), [http]),
    capabilities = useQuery({
      queryKey: [
        "bibi-admin",
        "content",
        "capabilities",
        session?.kind === "http" ? session.userId : null,
        session?.kind === "http" ? session.principal.revision : null,
      ],
      queryFn: ({ signal }) => {
        if (!api) throw Error("API nội dung chưa sẵn sàng");
        return api.capabilities(signal);
      },
      enabled: consumers > 0 && mode === "http" && session?.kind === "http" && Boolean(api),
      retry: false,
    });
  const value: ContentRuntime = {
    mode,
    api,
    capabilities: capabilities.data,
    pending: mode === "http" && session?.kind === "http" && capabilities.isPending,
    error: capabilities.error,
    retry: () => void capabilities.refetch(),
    can: (code) => canCode(session, code),
    subscribe,
  };
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}
export function useContent() {
  const value = useContext(ContentContext);
  const subscribe = value?.subscribe;
  useEffect(() => subscribe?.(), [subscribe]);
  if (!value) throw Error("ContentProvider missing");
  return value;
}
