import { useContext, useEffect, useRef, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import type { Editor as TinyEditor } from "tinymce";
import { useAdmin } from "../../services/context";
import { AdminThemeContext } from "../../shared/ui/admin-theme";
import { Button, Modal, Skeleton } from "../../shared/ui/primitives";
import { readRichContent, writeRichContent, escapeHtml } from "../rich-content";
import { resolveMedia } from "../media/resolve";
import {
  tinyAssetBase,
  tinyPlugins,
  resetFailedTinyAssets,
  type TinyAssetRegistry,
} from "./tiny-config";
import MediaPicker from "./media-picker";

export default function RichEditor({
  value,
  onChange,
  scope = "content",
  label = "Nội dung bài viết",
  onReadyChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  scope?: "content" | "products" | "bookstore";
  label?: string;
  onReadyChange?: (ready: boolean) => void;
  disabled?: boolean;
}) {
  const { store } = useAdmin();
  const dark = useContext(AdminThemeContext);
  const latest = useRef(value);
  latest.current = value;
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [imageWidth, setImageWidth] = useState("");
  const [imageError, setImageError] = useState("");
  const [inserting, setInserting] = useState(false);
  const editor = useRef<TinyEditor | null>(null);
  const bookmark = useRef<ReturnType<TinyEditor["selection"]["getBookmark"]> | null>(null);
  const leases = useRef<(() => void)[]>([]);
  const readyCallback = useRef(onReadyChange);
  readyCallback.current = onReadyChange;
  const active = useRef(true);
  const assetFailed = useRef(false);
  const cycle = useRef(0);
  const editingFigure = useRef<HTMLElement | null>(null);
  useEffect(() => {
    readyCallback.current?.(ready);
  }, [ready]);
  useEffect(() => {
    active.current = true;
    assetFailed.current = false;
    cycle.current++;
    setReady(false);
    setError("");
    setHtml(null);
    let current = true;
    const owned: (() => void)[] = [];
    const inserted = leases.current;
    const draft = document.createElement("div");
    draft.innerHTML = readRichContent(latest.current);
    void Promise.all(
      [...draft.querySelectorAll("img[data-media-id]")].map(async (img) => {
        try {
          const lease = await resolveMedia(store, img.getAttribute("data-media-id")!);
          if (!current) {
            lease.release();
            return;
          }
          owned.push(lease.release);
          img.setAttribute("src", lease.url);
        } catch {
          img.removeAttribute("src");
          img.setAttribute("alt", "Không đọc được ảnh");
        }
      }),
    ).then(() => {
      if (current) setHtml(draft.innerHTML);
    });
    return () => {
      current = false;
      active.current = false;
      owned.forEach((release) => release());
      inserted.splice(0).forEach((release) => release());
      editor.current = null;
      readyCallback.current?.(false);
    };
  }, [store, attempt, dark]);
  useEffect(() => {
    if (html === null || ready || error) return;
    const timeout = setTimeout(
      () => setError("Không tải được trình biên tập. Kiểm tra asset local rồi thử lại."),
      15000,
    );
    return () => clearTimeout(timeout);
  }, [html, ready, error]);
  const openImage = () => {
    const ed = editor.current;
    if (!ed) return;
    bookmark.current = ed.selection.getBookmark(2, true);
    const node = ed.selection.getNode();
    const img = node.nodeName === "IMG" ? (node as HTMLImageElement) : null;
    editingFigure.current = img ? (img.closest("figure") ?? img) : null;
    setImageIds(img?.dataset.mediaId ? [img.dataset.mediaId] : []);
    setAlt(img?.alt ?? "");
    setImageWidth(
      img?.getAttribute("width") ?? (img?.style.width ? String(parseFloat(img.style.width)) : ""),
    );
    setCaption(img?.closest("figure")?.querySelector("figcaption")?.textContent ?? "");
    setImageError("");
    setImageOpen(true);
  };
  const assetError = () => {
    assetFailed.current = true;
    setReady(false);
    setError("Không tải được trình biên tập. Kiểm tra asset local rồi thử lại.");
  };
  const retrySuffix = attempt ? `?retry=${attempt}` : "";
  return (
    <div className="a-editor-wrap">
      {error && (
        <div role="alert" className="a-dialog-body">
          <p>{error}</p>
          <Button
            onClick={() => {
              const tiny = (window as Window & { tinymce?: TinyAssetRegistry }).tinymce;
              if (tiny) resetFailedTinyAssets(tiny);
              setError("");
              setAttempt((a) => a + 1);
            }}
          >
            Thử lại
          </Button>
        </div>
      )}
      {html === null ? (
        <Skeleton rows={5} />
      ) : (
        !error && (
          <Editor
            key={`${attempt}-${dark}`}
            licenseKey="gpl"
            disabled={disabled}
            tinymceScriptSrc={`${tinyAssetBase}tinymce.min.js${retrySuffix}`}
            initialValue={html}
            onScriptsLoadError={assetError}
            onInit={(_event, instance) => {
              editor.current = instance ?? null;
              if (!assetFailed.current) setReady(true);
            }}
            onEditorChange={(content) => {
              if (editor.current?.initialized) onChange(writeRichContent(content));
            }}
            init={{
              base_url: tinyAssetBase.replace(/\/$/, ""),
              suffix: ".min",
              cache_suffix: retrySuffix,
              language: "vi",
              language_url: `${tinyAssetBase}langs/vi.js`,
              skin: dark ? "oxide-dark" : "oxide",
              content_css: dark ? "dark" : "default",
              height: 520,
              min_height: 340,
              menubar: "edit insert format table tools view",
              menu: {
                edit: {
                  title: "Edit",
                  items: "undo redo | cut copy paste | selectall | searchreplace",
                },
                insert: { title: "Insert", items: "bibiimage link | table charmap hr" },
                format: {
                  title: "Format",
                  items:
                    "bold italic underline strikethrough superscript subscript | blocks | align | forecolor backcolor | removeformat",
                },
                tools: { title: "Tools", items: "searchreplace wordcount" },
                view: { title: "View", items: "visualblocks | fullscreen" },
              },
              resize: true,
              branding: true,
              promotion: false,
              plugins: tinyPlugins,
              toolbar:
                "undo redo | blocks | bold italic underline | forecolor backcolor | bullist numlist | alignleft aligncenter alignright | outdent indent | link bibiimage table | fullscreen",
              toolbar_mode: "sliding",
              mobile: { menubar: true, toolbar_mode: "sliding" },
              table_default_attributes: { border: "1" },
              table_default_styles: { width: "100%", "border-collapse": "collapse" },
              table_advtab: false,
              table_cell_advtab: false,
              table_row_advtab: false,
              indent_use_margin: false,
              indentation: "40px",
              block_formats: "Đoạn văn=p;Tiêu đề 2=h2;Tiêu đề 3=h3;Tiêu đề 4=h4",
              iframe_aria_text: label,
              object_resizing: "img",
              paste_data_images: false,
              automatic_uploads: false,
              block_unsupported_drop: true,
              convert_urls: false,
              relative_urls: false,
              extended_valid_elements:
                "img[src|alt|data-media-id|width|height],figure[class],figcaption",
              content_style:
                "body{font-family:Inter,system-ui,sans-serif;font-size:16px;line-height:1.8;padding:14px}img{max-width:100%;height:auto}figure{margin:24px 0}figcaption{font-size:13px;color:#71717a;text-align:center}blockquote{border-left:3px solid #c1a77b;padding-left:18px;margin-left:0}h2,h3,h4{line-height:1.4}table{border-collapse:collapse;max-width:100%;margin:20px 0}td,th{border:1px solid #a1a1aa;padding:10px;overflow-wrap:anywhere}th{font-weight:600}sup,sub{font-size:75%}hr{border:0;border-top:1px solid #a1a1aa;margin:24px 0}",
              paste_preprocess: (_plugin, args) => {
                const draft = document.createElement("div");
                draft.innerHTML = args.content;
                draft.querySelectorAll("img").forEach((img) => img.remove());
                args.content = readRichContent(writeRichContent(draft.innerHTML));
              },
              setup: (ed) => {
                const currentCycle = cycle.current;
                ed.on(
                  "PluginLoadError LanguageLoadError SkinLoadError ModelLoadError IconsLoadError ThemeLoadError ContentCSSLoadError",
                  () => {
                    if (currentCycle === cycle.current) assetError();
                  },
                );
                ed.ui.registry.addMenuItem("bibiimage", {
                  icon: "image",
                  text: "Chèn hoặc sửa ảnh",
                  onAction: openImage,
                });
                ed.ui.registry.addButton("bibiimage", {
                  icon: "image",
                  tooltip: "Chèn hoặc sửa ảnh",
                  onAction: openImage,
                });
                ed.on("drop", (event) => {
                  if (event.dataTransfer?.files.length) event.preventDefault();
                });
              },
            }}
          />
        )
      )}
      <Modal
        open={imageOpen}
        onOpenChange={setImageOpen}
        title="Ảnh trong nội dung"
        description="Chọn ảnh, thêm mô tả và chú thích."
        wide
      >
        <div className="a-dialog-body a-compose-stack">
          <MediaPicker value={imageIds} onChange={setImageIds} max={1} scope={scope} />
          <label className="a-field">
            Mô tả ảnh (alt)
            <input value={alt} onChange={(e) => setAlt(e.target.value)} />
          </label>
          <label className="a-field">
            Chú thích
            <input value={caption} onChange={(e) => setCaption(e.target.value)} />
          </label>
          <label className="a-field">
            Chiều rộng ảnh (px)
            <input
              type="number"
              min={16}
              max={4096}
              step={1}
              value={imageWidth}
              onChange={(e) => setImageWidth(e.target.value)}
              placeholder="Tự động"
            />
            <small>Để trống để dùng kích thước tự nhiên. Ảnh tự thu nhỏ trên màn hình hẹp.</small>
          </label>
          {imageError && (
            <p role="alert" className="a-error">
              {imageError}
            </p>
          )}
          <div className="a-form-footer">
            {editingFigure.current && (
              <Button
                variant="destructive"
                onClick={() => {
                  const ed = editor.current;
                  if (ed) {
                    ed.undoManager.transact(() => editingFigure.current?.remove());
                    ed.dispatch("change");
                  }
                  setImageOpen(false);
                }}
              >
                Bỏ ảnh khỏi nội dung
              </Button>
            )}
            <Button
              variant="primary"
              loading={inserting}
              disabled={
                !imageIds[0] ||
                (imageWidth !== "" &&
                  (!Number.isInteger(Number(imageWidth)) ||
                    Number(imageWidth) < 16 ||
                    Number(imageWidth) > 4096))
              }
              onClick={async () => {
                const ed = editor.current;
                if (!ed) return;
                setInserting(true);
                setImageError("");
                try {
                  const lease = await resolveMedia(store, imageIds[0]);
                  if (!active.current || editor.current !== ed) {
                    lease.release();
                    return;
                  }
                  leases.current.push(lease.release);
                  const image = `<figure><img data-media-id="${escapeHtml(imageIds[0])}" src="${escapeHtml(lease.url)}" alt="${escapeHtml(alt)}"${imageWidth ? ` width="${Number(imageWidth)}"` : ""}>${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure><p></p>`;
                  ed.focus();
                  if (bookmark.current) ed.selection.moveToBookmark(bookmark.current);
                  if (editingFigure.current?.isConnected)
                    ed.undoManager.transact(() => {
                      ed.selection.select(editingFigure.current!);
                      ed.insertContent(image);
                    });
                  else ed.insertContent(image);
                  ed.dispatch("change");
                  setImageOpen(false);
                } catch {
                  setImageError("Không đọc được ảnh đã chọn.");
                } finally {
                  if (active.current) setInserting(false);
                }
              }}
            >
              {editingFigure.current ? "Cập nhật ảnh" : "Chèn ảnh"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
