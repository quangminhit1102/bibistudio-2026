import { defineSite } from "../src/platform/site-contract.ts";

export default defineSite({
  name: "BiBi Studio",
  shortName: "BiBi",
  url: "https://bibistudio.vn",
  locales: ["vi", "en"],
  defaultLocale: "vi",
  // Verified BiBi Studio contact channels (reused from the existing site — do not invent new ones).
  contact: {
    phone: "0392969000",
    phoneDisplay: "0392 969 000",
    email: "bibistudio@gmail.com",
    social: [
      { id: "zalo", label: "Zalo", href: "https://zalo.me/0392969000", display: "0392 969 000" },
      {
        id: "facebook",
        label: "Facebook",
        href: "https://www.facebook.com/bidiary",
        display: "BiBi Studio",
      },
      { id: "messenger", label: "Messenger", href: "https://m.me/bidiary", display: "Nhắn tin" },
    ],
    // Meeting point saved by BiBi Studio in Google Maps.
    location: {
      name: "Đường sách Nguyễn Văn Bình",
      address: "Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
      lat: 10.7805644,
      lng: 106.6998246,
      query: "Đường sách Nguyễn Văn Bình, Quận 1, TP. Hồ Chí Minh",
    },
  },
  company: {
    legalName: "Công Ty TNHH BI DIARY HANDMADE",
    address: "984/10 quốc lộ 1A, KP. 5, P. Linh Trung, Thành phố Thủ Đức, Thành phố Hồ Chí Minh",
  },
  seo: {
    titleSuffix: " — BiBi Studio",
    description: "BiBi Studio - so tay, thiep, postcard va giay viet thu lay cam hung tu Viet Nam.",
  },
  fonts: [
    {
      href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500;600&display=swap",
    },
  ],
  preconnect: [
    { href: "https://fonts.googleapis.com" },
    { href: "https://fonts.gstatic.com", crossOrigin: true },
  ],
  admin: {
    title: "BiBi Admin",
    modules: [
      "content",
      "products",
      "customers",
      "sales",
      "analytics",
      "accounts",
      "audit",
      "settings",
    ],
  },
});
