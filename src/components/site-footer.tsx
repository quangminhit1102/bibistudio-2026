const stores = [
  {
    name: "BiBi stationery & BiBi PPS",
    address: "8C, 352/8 Lê Hồng Phong, Phường 1, Quận 10",
    phone: "0986788698",
  },
  {
    name: "BiBi Hà Nội",
    address: "170 Hoàng Văn Thái, Phương Liệt, Thanh Xuân, Hà Nội",
    phone: "0986788698",
  },
  {
    name: "BiBi Cần Thơ",
    address: "66 Nguyễn Tri Phương, An Khánh, Ninh Kiều, Cần Thơ",
    phone: "0986788698",
  },
];

const community = [
  "Fanpage",
  "Instagram",
  "Youtube",
  "Tiktok",
  "Group BiBi Stationery",
  "Shopee",
  "Lazada",
];

const policies = [
  "Chính sách bảo mật",
  "Chính sách vận chuyển",
  "Chính sách đổi trả",
  "Chính sách bảo hành",
  "Phương thức thanh toán",
];

export function SiteFooter() {
  return (
    <footer className="bg-secondary">
      <div className="border-b border-border/70">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-4 py-8 md:flex-row md:justify-between">
          <h2 className="section-title text-lg">Đăng ký nhận tin khuyến mãi</h2>
          <form
            className="flex w-full max-w-md items-center border border-primary/30 bg-background"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="email"
              required
              placeholder="Nhập email của bạn"
              className="w-full bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="shrink-0 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-accent"
            >
              Đăng ký
            </button>
          </form>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <h3 className="section-title mb-4 text-sm">Cửa hàng</h3>
          <ul className="space-y-4 text-sm text-muted-foreground">
            {stores.map((s) => (
              <li key={s.name}>
                <p className="font-medium text-foreground">{s.name}</p>
                <p>Địa chỉ: {s.address}</p>
                <p>
                  Hotline:{" "}
                  <a href={`tel:${s.phone}`} className="hover:text-accent">
                    {s.phone}
                  </a>
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="section-title mb-4 text-sm">Cộng đồng</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {community.map((c) => (
              <li key={c}>
                <a href="#" className="hover:text-accent">
                  {c}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="section-title mb-4 text-sm">Chính sách</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {policies.map((p) => (
              <li key={p}>
                <a href="#" className="hover:text-accent">
                  {p}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="section-title mb-4 text-sm">Chấp nhận thanh toán</h3>
          <img
            src="https://bizweb.dktcdn.net/100/343/063/themes/792164/assets/i_payment.png"
            alt="Các phương thức thanh toán được chấp nhận"
            loading="lazy"
            className="max-w-[220px]"
          />
          <p className="mt-4 text-sm text-muted-foreground">
            Hotline:{" "}
            <a href="tel:0986788698" className="font-semibold text-accent">
              0986788698
            </a>
          </p>
        </div>
      </div>

      <div className="border-t border-border/70">
        <p className="mx-auto max-w-[1200px] px-4 py-5 text-center text-xs text-muted-foreground">
          Bản quyền thuộc về BiBi Studio | bibistudio.vn
        </p>
      </div>
    </footer>
  );
}
