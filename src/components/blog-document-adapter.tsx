import { useEffect } from "react";
export function BlogDocumentAdapter() {
  const path = typeof window === "undefined" ? "/blog" : location.pathname + location.search;
  useEffect(() => {
    const key = "bibi:blog-document:" + path;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      window.location.replace(path);
    } catch {
      /* A direct link remains available when browser storage is disabled. */
    }
  }, [path]);
  return (
    <main className="mx-auto max-w-3xl px-5 py-20">
      <h1>Nhật ký BiBi Studio</h1>
      <p>
        Đang mở bản công khai…{" "}
        <a href={path} className="underline">
          Mở bài viết
        </a>
      </p>
    </main>
  );
}
