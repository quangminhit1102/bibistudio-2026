import { useEffect, useState } from "react";
import { useAdmin } from "../../services/context";
export function MediaImage({
  id,
  alt,
  className = "",
}: {
  id: string;
  alt: string;
  className?: string;
}) {
  const { store } = useAdmin();
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setFailed(false);
    void store
      .get("media", id)
      .then(async (asset) => {
        if (!asset) throw new Error("missing");
        if (asset.url) {
          if (active) setUrl(asset.url);
          return;
        }
        const blob = await store.getBlob(asset.blobKey);
        if (!blob) throw new Error("missing blob");
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, store]);
  return url && !failed ? (
    <img src={url} alt={alt} className={className} onError={() => setFailed(true)} />
  ) : (
    <span
      className={`a-thumb a-thumb-letter ${className}`}
      title={failed ? "Không đọc được ảnh" : "Đang tải ảnh"}
    >
      {failed ? "!" : "…"}
    </span>
  );
}
