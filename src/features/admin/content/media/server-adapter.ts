import type { ContentHttpModule, RichMediaAdapter } from "../contracts";
export function createServerMediaAdapter(media: ContentHttpModule["media"]): RichMediaAdapter {
  return {
    async resolve(id, signal) {
      signal?.throwIfAborted();
      const image = await media.get(id, signal),
        variant = [...image.variants].sort((a, b) => b.width - a.width)[0];
      if (!variant) throw Error("Không đọc được ảnh");
      const blob = await media.read(image.id, variant.hash, signal);
      signal?.throwIfAborted();
      const url = URL.createObjectURL(blob);
      let released = false;
      const release = () => {
        if (!released) {
          released = true;
          URL.revokeObjectURL(url);
          signal?.removeEventListener("abort", release);
        }
      };
      signal?.addEventListener("abort", release, { once: true });
      if (signal?.aborted) {
        release();
        signal.throwIfAborted();
      }
      return { url, release };
    },
  };
}
