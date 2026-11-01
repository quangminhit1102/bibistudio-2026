import { useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import { useAdmin } from "../../services/context";
import { Button, Modal } from "../../shared/ui/primitives";
import { safeDocument } from "../sanitize";
import MediaPicker from "./media-picker";
export default function RichEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange: (json: string) => void;
  readOnly?: boolean;
}) {
  const { store } = useAdmin();
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [linkError, setLinkError] = useState("");
  const image = useMemo(
    () =>
      ImageExtension.extend({
        addAttributes() {
          return { ...this.parent?.(), mediaId: { default: null } };
        },
        addNodeView() {
          return ({ node }) => {
            const img = document.createElement("img");
            img.alt = String(node.attrs.alt ?? "Ảnh bài viết");
            let objectUrl = "",
              disposed = false;
            void store.getBlob(String(node.attrs.mediaId)).then((blob) => {
              if (blob && !disposed) {
                objectUrl = URL.createObjectURL(blob);
                img.src = objectUrl;
              }
            });
            return {
              dom: img,
              destroy() {
                disposed = true;
                if (objectUrl) URL.revokeObjectURL(objectUrl);
              },
            };
          };
        },
      }),
    [store],
  );
  const editor = useEditor(
    {
      extensions: [StarterKit.configure({ link: { openOnClick: false } }), image],
      content: safeDocument(value),
      editable: !readOnly,
      editorProps: {
        attributes: {
          role: "textbox",
          "aria-label": "Nội dung bài viết",
          "aria-multiline": "true",
        },
      },
      immediatelyRender: false,
      onUpdate: ({ editor }) =>
        onChange(JSON.stringify(safeDocument(JSON.stringify(editor.getJSON())))),
    },
    [store],
  );
  if (!editor) return null;
  return (
    <div className="a-editor-wrap">
      {!readOnly && (
        <div className="a-editor-toolbar">
          <Button
            size="sm"
            variant={editor.isActive("bold") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleBold().run()}
            aria-pressed={editor.isActive("bold")}
          >
            Đậm
          </Button>
          <Button size="sm" onClick={() => editor.chain().focus().toggleItalic().run()}>
            Nghiêng
          </Button>
          <Button
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H2
          </Button>
          <Button
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            H3
          </Button>
          <Button size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()}>
            Danh sách
          </Button>
          <Button size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            1. Danh sách
          </Button>
          <Button size="sm" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            Trích dẫn
          </Button>
          <Button size="sm" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            Code
          </Button>
          <Button size="sm" onClick={() => setLinkOpen(true)}>
            Liên kết
          </Button>
          <Button size="sm" onClick={() => setImageOpen(true)}>
            Ảnh
          </Button>
          <Button
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            Hoàn tác
          </Button>
        </div>
      )}
      <EditorContent editor={editor} />
      <Modal open={linkOpen} onOpenChange={setLinkOpen} title="Chèn liên kết">
        <div className="a-dialog-body">
          <label className="a-field">
            URL
            <input value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://…" />
          </label>
          {linkError && (
            <p role="alert" className="a-error">
              {linkError}
            </p>
          )}
          <div className="a-form-footer">
            <Button
              onClick={() => {
                editor.chain().focus().unsetLink().run();
                setLinkOpen(false);
              }}
            >
              Bỏ liên kết
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!/^(https?:|mailto:)/i.test(href)) {
                  setLinkError("Chỉ cho phép https, http hoặc mailto.");
                  return;
                }
                editor
                  .chain()
                  .focus()
                  .setLink({ href, target: "_blank", rel: "noopener noreferrer" })
                  .run();
                setLinkOpen(false);
                setLinkError("");
              }}
            >
              Chèn
            </Button>
          </div>
        </div>
      </Modal>
      <Modal open={imageOpen} onOpenChange={setImageOpen} title="Chèn ảnh bài viết" wide>
        <div className="a-dialog-body">
          <MediaPicker value={imageIds} onChange={setImageIds} />
          <Button
            variant="primary"
            onClick={() => {
              for (const id of imageIds)
                editor
                  .chain()
                  .focus()
                  .insertContent({ type: "image", attrs: { mediaId: id, src: "bibi-media:" + id } })
                  .run();
              setImageOpen(false);
              setImageIds([]);
            }}
          >
            Chèn ảnh đã chọn
          </Button>
        </div>
      </Modal>
    </div>
  );
}
