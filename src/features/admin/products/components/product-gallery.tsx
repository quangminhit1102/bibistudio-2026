import MediaPicker from "../../content/components/media-picker";
import { MediaImage } from "../../content/components/media-image";
import { Button } from "../../shared/ui/primitives";
import { ArrowUp, ArrowDown, Star, X } from "lucide-react";
export default function ProductGallery({
  value,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  const move = (from: number, to: number) => {
    const next = [...value];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id);
    onChange(next);
  };
  return (
    <fieldset disabled={disabled} className="a-product-gallery">
      <legend className="a-sr-only">Ảnh sản phẩm</legend>
      <MediaPicker
        value={value}
        onChange={onChange}
        max={10}
        scope="products"
        showSelection={false}
      />
      {!value.length && (
        <div className="a-gallery-empty">Thêm hình ảnh để giới thiệu sản phẩm.</div>
      )}
      <div className="a-gallery-items">
        {value.map((id, i) => (
          <div className="a-gallery-row" key={id}>
            <MediaImage id={id} alt={`Ảnh sản phẩm ${i + 1}`} />
            <div>
              <strong>{i === 0 ? "Ảnh chính" : `Ảnh ${i + 1}`}</strong>
              <div className="a-actions">
                <Button
                  size="icon"
                  disabled={!i}
                  aria-label={`Đưa ảnh ${i + 1} lên`}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp size={15} />
                </Button>
                <Button
                  size="icon"
                  disabled={i === value.length - 1}
                  aria-label={`Đưa ảnh ${i + 1} xuống`}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown size={15} />
                </Button>
                {i > 0 && (
                  <Button size="sm" onClick={() => move(i, 0)}>
                    <Star size={14} />
                    Đặt làm ảnh chính
                  </Button>
                )}
                <Button
                  size="icon"
                  aria-label={`Bỏ ảnh ${i + 1}`}
                  onClick={() => onChange(value.filter((v) => v !== id))}
                >
                  <X size={15} />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
