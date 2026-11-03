import { useEffect, useRef } from "react";
import { useAdmin } from "../../services/context";
import { readRichContent } from "../rich-content";
import { resolveMedia } from "../media/resolve";

export default function RichContentView({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const { store } = useAdmin();
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = container.current;
    if (!host) return;
    let active = true;
    const leases: (() => void)[] = [];
    const draft = document.createElement("div");
    draft.innerHTML = readRichContent(value);
    const images = [...draft.querySelectorAll("img[data-media-id]")];
    images.forEach((img) => img.removeAttribute("src"));
    host.replaceChildren(...draft.childNodes);
    for (const img of images)
      void resolveMedia(store, img.getAttribute("data-media-id")!)
        .then((lease) => {
          if (!active) {
            lease.release();
            return;
          }
          leases.push(lease.release);
          img.setAttribute("src", lease.url);
          img.addEventListener(
            "error",
            () => {
              img.removeAttribute("src");
              img.setAttribute("alt", "Không đọc được ảnh");
            },
            { once: true },
          );
        })
        .catch(() => {
          if (active)
            img.replaceWith(
              Object.assign(document.createElement("span"), {
                className: "a-media-missing",
                textContent: "Không đọc được ảnh",
              }),
            );
        });
    return () => {
      active = false;
      leases.forEach((release) => release());
    };
  }, [value, store]);
  return <div ref={container} className={`a-rich-content ${className}`} />;
}
