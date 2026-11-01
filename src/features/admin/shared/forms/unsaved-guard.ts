import { useBlocker } from "@tanstack/react-router";
export function useUnsavedChanges(dirty: boolean) {
  return useBlocker({ shouldBlockFn: () => dirty, enableBeforeUnload: dirty, withResolver: true });
}
