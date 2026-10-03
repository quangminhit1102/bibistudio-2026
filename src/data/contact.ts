// Verified BiBi Studio contact channels (reused from the existing site — do not invent new ones).
export const contact = {
  phone: "0392969000",
  phoneDisplay: "0392 969 000",
  email: "bibistudio@gmail.com",
  zalo: "https://zalo.me/0392969000",
  facebook: "https://www.facebook.com/sharetosmile12",
  messenger: "https://m.me/sharetosmile12",
};

// Meeting point saved by BiBi Studio in Google Maps.
const placeQuery = "Đường sách Nguyễn Văn Bình, Quận 1, TP. Hồ Chí Minh";

export const studioLocation = {
  name: "Đường sách Nguyễn Văn Bình",
  address: "Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
  lat: 10.7805644,
  lng: 106.6998246,
  embed: `https://www.google.com/maps?q=${encodeURIComponent(placeQuery)}&z=16&output=embed`,
  maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery)}`,
  directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(placeQuery)}`,
};
