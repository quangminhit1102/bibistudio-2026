import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Flower2,
  Mail,
  MapPin,
  NotebookPen,
  Sticker,
  type LucideIcon,
} from "lucide-react";
import {
  collections,
  getCollection,
  getProductType,
  occasions,
  productsByOccasion,
  productTypes,
  tx,
  type Collection,
  type ProductTypeId,
} from "@/data/catalogue";
import { homepageProducts } from "@/data/homepage";
import { contact } from "@/data/contact";
import { Reveal } from "./brand/reveal";
import heroImg from "@/assets/hero-desk.jpg";
import "@/styles/homepage.css";

const typeIcons: Record<ProductTypeId, LucideIcon> = {
  notebook: NotebookPen,
  "greeting-card": Flower2,
  postcard: MapPin,
  envelope: Mail,
  "letter-paper": BookOpen,
  magnet: Sticker,
};

function CollectionCard({ collection, lead = false }: { collection: Collection; lead?: boolean }) {
  return (
    <Link
      to="/collections/$slug"
      params={{ slug: collection.slug }}
      className={`home-collection ${lead ? "home-collection-lead" : ""}`}
    >
      <div className="home-collection-image">
        {collection.image ? (
          <img src={collection.image} alt="" loading="lazy" width={800} height={600} />
        ) : (
          <div className="home-collection-letter" aria-hidden="true">
            <Flower2 />
            <span>BiBi Studio</span>
          </div>
        )}
      </div>
      <div className="home-card-caption">
        <div>
          <h3>{tx(collection.name)}</h3>
          <p>{lead ? tx(collection.intro ?? collection.tagline) : tx(collection.tagline)}</p>
        </div>
        <ArrowRight aria-hidden="true" />
      </div>
    </Link>
  );
}

export function Homepage() {
  const featured = homepageProducts();
  const [leadCollection, ...otherCollections] = collections;
  const availableOccasions = occasions
    .filter((o) => productsByOccasion(o.id).some((p) => p.images.length))
    .slice(0, 4);
  return (
    <div className="bibi-home">
      <section className="home-hero home-wrap" aria-label="BiBi Studio">
        <div className="home-hero-copy">
          <p className="home-kicker">BiBi Studio · Những món đồ nhỏ</p>
          <h1>
            Sổ tay, thiệp và những món quà <em>mang nét Việt.</em>
          </h1>
          <p className="home-hero-description">
            Khám phá sổ tay, thiệp, postcard, bao thư, giấy viết thư và magnet của BiBi Studio.
          </p>
          <div className="home-actions">
            <Link to="/products" className="home-button">
              Xem các mẫu <ArrowRight aria-hidden="true" />
            </Link>
            <Link to="/collections" className="home-text-link">
              Bộ sưu tập <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
        <figure className="home-hero-image">
          <img
            src={heroImg}
            alt="Sổ tay, postcard, bao thư và giấy viết thư BiBi trên bàn"
            width={1920}
            height={1152}
            fetchPriority="high"
          />
          <figcaption>Một góc bàn giấy, một chút Việt Nam.</figcaption>
        </figure>
      </section>

      <section className="home-types home-wrap" aria-labelledby="home-types-title">
        <div className="home-section-heading">
          <h2 id="home-types-title">Bạn muốn xem gì?</h2>
          <span className="home-section-note">Bắt đầu từ một món đồ bạn thích.</span>
        </div>
        <div className="home-type-grid">
          {productTypes.map((type, i) => {
            const Icon = typeIcons[type.id];
            return (
              <Link
                key={type.id}
                to="/products/$slug"
                params={{ slug: type.slug }}
                className="home-type"
                aria-label={tx(type.name)}
              >
                <span className="home-type-top">
                  <Icon aria-hidden="true" />
                  <span aria-hidden="true">0{i + 1}</span>
                </span>
                <span className="home-type-name">
                  {tx(type.name)}
                  <ArrowRight aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="home-featured home-section" aria-labelledby="home-featured-title">
        <div className="home-wrap">
          <Reveal className="home-section-heading">
            <div>
              <p className="home-kicker">Trên bàn của BiBi</p>
              <h2 id="home-featured-title">Mẫu BiBi chọn</h2>
            </div>
            <Link to="/products" className="home-text-link">
              Xem tất cả mẫu <ArrowRight aria-hidden="true" />
            </Link>
          </Reveal>
          <div className="home-product-grid">
            {featured.map(({ product }) => (
              <Link
                key={product.slug}
                to="/products/$slug"
                params={{ slug: product.slug }}
                className="home-product"
              >
                <div className="home-product-image">
                  <img
                    src={product.images[0]}
                    alt={tx(product.name)}
                    width={640}
                    height={800}
                    loading="lazy"
                  />
                </div>
                <div className="home-card-caption">
                  <div>
                    <p className="home-product-type">
                      {tx(getProductType(product.productType).name)}
                    </p>
                    <h3>{tx(product.name)}</h3>
                    <p>{tx(getCollection(product.collection).name)}</p>
                  </div>
                  <ArrowRight aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        className="home-collections home-section home-wrap"
        aria-labelledby="home-collections-title"
      >
        <Reveal className="home-section-heading">
          <div>
            <p className="home-kicker">Những câu chuyện trên giấy</p>
            <h2 id="home-collections-title">Khám phá bộ sưu tập</h2>
          </div>
          <Link to="/collections" className="home-text-link">
            Tất cả bộ sưu tập <ArrowRight aria-hidden="true" />
          </Link>
        </Reveal>
        <CollectionCard collection={leadCollection} lead />
        <div className="home-collection-grid">
          {otherCollections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      </section>

      {availableOccasions.length > 0 && (
        <section className="home-occasions home-section" aria-labelledby="home-occasions-title">
          <div className="home-wrap">
            <div className="home-section-heading">
              <div>
                <p className="home-kicker">Một lời nhắn gửi</p>
                <h2 id="home-occasions-title">Một tấm thiệp cho mỗi dịp</h2>
              </div>
              <Link
                to="/collections/$slug"
                params={{ slug: "greeting-cards" }}
                className="home-text-link"
              >
                Xem các mẫu thiệp <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <div
              className="home-occasion-grid"
              style={{
                gridTemplateColumns: `repeat(${Math.min(availableOccasions.length, 4)}, minmax(0, 1fr))`,
              }}
            >
              {availableOccasions.map((occasion, i) => (
                <Link
                  key={occasion.id}
                  to="/collections/$slug"
                  params={{ slug: "greeting-cards" }}
                  hash={occasion.id}
                  className={`home-occasion ${availableOccasions.length === 1 ? "home-occasion-single" : ""}`}
                >
                  <span className="home-kicker" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <h3>{tx(occasion.name)}</h3>
                  <span className="home-text-link">
                    Xem mẫu <ArrowRight aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="home-story home-section home-wrap" aria-labelledby="home-story-title">
        <div className="home-story-photos">
          <img
            src="/catalogue/notebook-bun-bo-hue-detail.webp"
            alt="Chi tiết hình in Bún bò Huế trên giấy, đặt trên bàn gỗ"
            width={1600}
            height={1200}
            loading="lazy"
          />
          <img
            src="/catalogue/pressed-flower-cards-main.jpg"
            alt="Những tấm thiệp hoa của BiBi"
            width={797}
            height={638}
            loading="lazy"
          />
        </div>
        <Reveal className="home-story-copy">
          <p className="home-kicker">Một góc BiBi</p>
          <h2 id="home-story-title">
            Những điều nhỏ,
            <br />
            <em>muốn được giữ lại.</em>
          </h2>
          <p>
            BiBi Studio tạo nên những món đồ giấy cho khoảnh khắc thường ngày, lấy cảm hứng từ Việt
            Nam, thiên nhiên và những câu chuyện nhỏ.
          </p>
          <p>Một lời nhắn nhỏ. Một nơi ta nhớ. Một cảm xúc ta muốn giữ.</p>
          <Link to="/about" className="home-text-link">
            Về BiBi <ArrowRight aria-hidden="true" />
          </Link>
          <p className="home-signature">Little things, made to touch your heart.</p>
        </Reveal>
      </section>

      <section className="home-contact home-section" aria-labelledby="home-contact-title">
        <div className="home-wrap home-contact-inner">
          <div>
            <p className="home-kicker">BiBi luôn ở đây</p>
            <h2 id="home-contact-title">
              Bạn đã tìm được
              <br />
              mẫu mình thích?
            </h2>
            <p>Nhắn BiBi để tìm hiểu thêm.</p>
          </div>
          <div className="home-contact-actions">
            <Link to="/contact" className="home-button">
              Liên hệ BiBi <ArrowRight aria-hidden="true" />
            </Link>
            <div>
              <a
                href={contact.zalo}
                target="_blank"
                rel="noopener noreferrer"
                className="home-text-link"
              >
                Zalo
              </a>
              <a
                href={contact.messenger}
                target="_blank"
                rel="noopener noreferrer"
                className="home-text-link"
              >
                Messenger
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
