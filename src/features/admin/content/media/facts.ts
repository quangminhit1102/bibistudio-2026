import { useQuery } from "@tanstack/react-query";
import type { MediaAsset } from "../../services/contracts";
import { publicPath } from "./resolve";

export interface MediaFacts {
  width: number;
  height: number;
  size: number;
  mime: string;
}

/** Fetches a public path of this site; any other url is refused without a request. */
export async function measureImage(url: string, signal?: AbortSignal): Promise<MediaFacts> {
  const response = await fetch(publicPath(url), { signal });
  if (!response.ok) throw new Error("Không đọc được ảnh.");
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height, size: blob.size, mime: blob.type };
  } finally {
    bitmap.close();
  }
}

/** `facts` is null while a file is measured and when it cannot be measured. */
export function useMediaFacts(asset: MediaAsset): { facts: MediaFacts | null; pending: boolean } {
  const stored = asset.width > 0 && asset.height > 0 && asset.size > 0;
  const measured = useQuery({
    queryKey: ["bibi-admin", "media-facts", asset.url],
    queryFn: ({ signal }) => measureImage(asset.url ?? "", signal),
    enabled: !stored && !!asset.url,
    staleTime: Infinity,
    retry: false,
  });
  if (stored)
    return {
      facts: { width: asset.width, height: asset.height, size: asset.size, mime: asset.mime },
      pending: false,
    };
  return { facts: measured.data ?? null, pending: !!asset.url && measured.isPending };
}
