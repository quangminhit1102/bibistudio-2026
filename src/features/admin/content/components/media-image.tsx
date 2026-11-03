import { useEffect, useState } from "react";
import { useAdmin } from "../../services/context";
import { resolveMedia } from "../media/resolve";
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
    let release = () => {};
    setFailed(false);
    setUrl("");
    void resolveMedia(store, id)
      .then((lease) => {
        if (!active) {
          lease.release();
          return;
        }
        release = lease.release;
        setUrl(lease.url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      release();
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
