import { useMemo } from "react";
import { useAdmin } from "../services/context";
import { createAccountApi } from "./http-api";
export function useAccountApi() {
  const { http } = useAdmin();
  return useMemo(() => {
    if (!http) throw new Error("HTTP account service is unavailable");
    return createAccountApi(http);
  }, [http]);
}
