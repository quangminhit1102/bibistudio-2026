import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Monitor, Smartphone } from "lucide-react";
import { useAdmin } from "../../services/context";
import { Button, Modal } from "../ui/primitives";
import { MediaImage } from "../../content/components/media-image";
import RichContentView from "../../content/components/rich-content-view";
import { productTypes, collectionOptions } from "../../products/config";
import { date } from "../lib/text";
import type { FormValues } from "./record-form";
export type EditorSnapshot = { kind: "post" | "product"; record: FormValues };
export default function EditorPreview({
  open,
  onOpenChange,
  snapshot,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: EditorSnapshot;
}) {
  const [mobile, setMobile] = useState(false),
    [activeImage, setActiveImage] = useState(0);
  const { store } = useAdmin();
  const record = snapshot.record,
    post = snapshot.kind === "post";
  const metadata = useQuery({
    queryKey: ["bibi-admin", "preview-meta", record.categoryId, record.authorId],
    enabled: open && post,
    queryFn: async () => ({
      category: await store.get("categories", String(record.categoryId)),
      author: await store.get("users", String(record.authorId)),
    }),
  });
  const images = Array.isArray(record.imageIds) ? (record.imageIds as string[]) : [];
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={post ? "Xem trước bài viết" : "Xem trước sản phẩm"}
      description="Nội dung đang biên tập, bao gồm thay đổi chưa lưu."
      wide
      className="a-editor-preview-modal"
    >
      <div className="a-preview-controls">
        <Button
          size="sm"
          variant={!mobile ? "secondary" : "ghost"}
          aria-pressed={!mobile}
          onClick={() => setMobile(false)}
        >
          <Monitor size={16} />
          Desktop
        </Button>
        <Button
          size="sm"
          variant={mobile ? "secondary" : "ghost"}
          aria-pressed={mobile}
          onClick={() => setMobile(true)}
        >
          <Smartphone size={16} />
          Mobile
        </Button>
      </div>
      <div className="a-preview-stage">
        <article className={`a-brand-reader ${mobile ? "a-brand-reader-mobile" : ""}`}>
          <div className="a-preview-brand">
            BiBi Studio <small>MADE WITH HEART</small>
          </div>
          {post ? (
            <>
              {record.imageId && (
                <div className="a-preview-cover">
                  <MediaImage id={String(record.imageId)} alt={String(record.title ?? "Ảnh bìa")} />
                </div>
              )}
              <div className="a-preview-article">
                <div className="a-preview-eyebrow">
                  {metadata.data?.category?.name ?? "Nhật ký"}
                </div>
                <h1>{String(record.title || "Tiêu đề bài viết")}</h1>
                <p className="a-preview-meta">
                  {metadata.data?.author?.name ?? "BiBi Studio"}
                  {record.publishAt ? ` · ${date(String(record.publishAt))}` : ""}
                </p>
                <p className="a-preview-excerpt">{String(record.excerpt ?? "")}</p>
                <RichContentView value={String(record.content ?? "")} />
              </div>
            </>
          ) : (
            <>
              <div className="a-preview-product">
                <div>
                  <div className="a-preview-product-image">
                    {images[activeImage] && (
                      <MediaImage
                        id={images[activeImage]}
                        alt={String(record.name ?? "Ảnh sản phẩm")}
                      />
                    )}
                  </div>
                  {images.length > 1 && (
                    <div className="a-preview-thumbnails">
                      {images.map((id, i) => (
                        <button
                          key={id}
                          type="button"
                          aria-label={`Xem ảnh ${i + 1}`}
                          aria-pressed={activeImage === i}
                          onClick={() => setActiveImage(i)}
                        >
                          <MediaImage id={id} alt={`Ảnh ${i + 1}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="a-preview-product-info">
                  <div className="a-preview-eyebrow">
                    {productTypes.find((o) => o.value === record.productType)?.label ?? "Sản phẩm"}
                  </div>
                  <h1>{String(record.name || "Tên sản phẩm")}</h1>
                  <p className="a-preview-collection">
                    Bộ sưu tập{" "}
                    {collectionOptions.find((o) => o.value === record.collection)?.label ?? ""}
                  </p>
                  <p>{String(record.shortDescription ?? "")}</p>
                  <div className="a-preview-contact">
                    <h3>Bạn quan tâm đến sản phẩm này?</h3>
                    <p>Liên hệ BiBi Studio để được tư vấn chi tiết.</p>
                    <p>0392 969 000 · bibistudio@gmail.com</p>
                    <a href="/contact" target="_blank" rel="noopener noreferrer">
                      Liên hệ BiBi Studio
                    </a>
                  </div>
                </div>
              </div>
              <div className="a-preview-article">
                <RichContentView value={String(record.description ?? "")} />
              </div>
            </>
          )}
        </article>
      </div>
    </Modal>
  );
}
