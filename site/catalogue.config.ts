import { defineCatalogue } from "../src/platform/site-contract.ts";

export default defineCatalogue({
  attributes: [
    { key: "dimensions", label: { vi: "Kích thước", en: "Dimensions" }, type: "text" },
    { key: "material", label: { vi: "Chất liệu", en: "Material" }, type: "localized-text" },
    { key: "pages", label: { vi: "Số trang", en: "Pages" }, type: "text" },
    { key: "format", label: { vi: "Định dạng", en: "Format" }, type: "localized-text" },
    {
      key: "occasion",
      label: { vi: "Dịp lễ", en: "Occasion" },
      type: "select",
      // Occasions (dịp lễ) group greeting cards inside the "greeting-cards" collection.
      options: [
        {
          value: "womens-day-83",
          label: { vi: "8/3 — Quốc tế Phụ nữ", en: "Mar 8 — International Women's Day" },
          note: {
            vi: "Những tấm thiệp hoa tươi sắc màu dành tặng mẹ, chị, bạn gái và đồng nghiệp.",
            en: "Bright floral cards for mothers, sisters, partners and colleagues.",
          },
        },
        {
          value: "birthday",
          label: { vi: "Sinh nhật", en: "Birthday" },
          note: {
            vi: "Lời chúc tuổi mới gửi trong một tấm thiệp nhỏ.",
            en: "Birthday wishes folded into a little card.",
          },
        },
        {
          value: "womens-day-2010",
          label: { vi: "20/10 — Phụ nữ Việt Nam", en: "Oct 20 — Vietnamese Women's Day" },
          note: {
            vi: "Ngày riêng của phụ nữ Việt, dịp để nói lời trân trọng.",
            en: "Vietnam's own day to honour the women around you.",
          },
        },
        {
          value: "teachers-day-2011",
          label: { vi: "20/11 — Nhà giáo Việt Nam", en: "Nov 20 — Vietnamese Teachers' Day" },
          note: {
            vi: "Gửi thầy cô một lời cảm ơn viết tay.",
            en: "A handwritten thank-you for teachers.",
          },
        },
        {
          value: "christmas",
          label: { vi: "Giáng sinh", en: "Christmas" },
          note: {
            vi: "Ấm áp cuối năm, thiệp xanh đỏ và những lời chúc mùa lễ.",
            en: "Warm year-end greetings for the festive season.",
          },
        },
        {
          value: "tet",
          label: { vi: "Lì xì Tết", en: "Tet & Lucky Money" },
          note: {
            vi: "Bao lì xì và thiệp chúc Tết cho năm mới sum vầy.",
            en: "Lucky-money envelopes and New Year cards.",
          },
        },
        {
          value: "valentine",
          label: { vi: "Valentine 14/2", en: "Valentine's Day" },
          note: {
            vi: "Cho những lời yêu khó nói thành lời.",
            en: "For feelings that are hard to say out loud.",
          },
        },
        {
          value: "thank-you",
          label: { vi: "Cảm ơn & chúc mừng", en: "Thank You & Congrats" },
          note: {
            vi: "Khai trương, tốt nghiệp, năm mới — mọi dịp đáng mừng.",
            en: "Openings, graduations, new year — every happy occasion.",
          },
        },
      ],
    },
  ],
  groupBy: { "greeting-cards": "occasion" },
});
