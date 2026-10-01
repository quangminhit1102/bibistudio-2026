# BiBi Studio — From online shop to brand catalogue

Turn the current shop-style site into a calm, editorial brand site: Products by type, Collections by theme, About, Contact. No cart, prices, sale labels, buy buttons or quantity anywhere. Every product leads to "Contact BiBi Studio".

## What changes for visitors

- **Header**: Logo · Products · Collections · About · Contact · VI/EN. Search, account and cart removed. Mobile: menu, logo, language, phone icon.
- **Homepage** (in order): full-height hero ("Little things, made to touch your heart." + Explore Collections / View Products) → brand statement ("Paper can hold a memory.") → asymmetric Collections gallery (Explore Vietnam large) → "What we make" numbered 01–06 product types → Explore Vietnam featured story → short About → Contact band → Footer.
- **Products** `/products` with understated pill filters (type + collection) and simple name search; type pages `/products/notebooks`, `greeting-cards`, `postcards`, `envelopes`, `letter-paper`, `magnets`.
- **Collections** `/collections` + 7 chapter pages: explore-vietnam (signature, richer sections), vietnamese-food, motivation (large quote), ao-dai, greeting-cards, animals, spiral-cards.
- **Product detail** `/products/<name>`: large gallery left, name / type / collection / short story right, a Details list only with attributes that exist, then a prominent "Interested in this product?" contact block (phone, email, Zalo, Facebook/Messenger).
- **About** and **Contact** pages (contact uses hotline 0392969000 and only links already in the project).
- **Journal** kept as a secondary section (existing articles), moved off the main menu into the footer.
- Floating contact buttons stay.

## Content honesty

- Third-party items (MUJI, Zebra, Deli…) removed from the catalogue.
- The project has no real BiBi product list yet, so I'll create a small starter catalogue using neutral names that follow your examples (e.g. "Saigon" notebook, "Phở" postcard, "Happy Birthday" card) — clearly marked for you to replace. No invented sizes, materials or claims; fields left empty are simply hidden.
- No placehold.co images: a branded ivory "paper" placeholder showing the product type and "Image coming soon" until real photos are added.

## Look and feel

- Neutral paper palette from the brief: ivory #F7F5EF, paper #EFE9DD, text #202020, muted #6D6A63, sage #87967B used sparingly, kraft #BDA47D.
- Type: Inter for interface + Cormorant Garamond for editorial headlines.
- Quiet motion: hero fade-up and 1.03→1 image settle, gentle scroll reveals, slow image zoom on hover; respects reduced-motion.

## Language

VI default with full bilingual text structures for nav, collections, product types and page copy. EN stays visible in the switcher; I'll wire the content so EN can be switched on, but keep it marked "Soon" unless you want it live now (URLs stay as they are, no /vi /en prefix for now).

## Technical details

- New data module: `productTypes`, `collections`, `products` (id, slug, productType, collection, bilingual name/description, optional dimensions/material/pages, images, featured, sortOrder, status) + repository helpers; old `products.ts`/`catalog.ts` shop data retired.
- Routes: `products.index`, `products.$slug` (resolves type slug → listing, else product detail), `collections.index`, `collections.$slug`, `about`, `contact`; existing blog routes kept. Each with own head() meta.
- Components replaced/removed: product-card (catalogue card), product-carousel, hero-slider, banner-sections, product options/quantity; header/footer rewritten (remove payment/shipping/return policy).
- Small i18n context with `t()` over `{vi, en}` objects; language persisted client-side.
- End-to-end check with Playwright on both journeys: Home → Collections → Collection → Product → Contact, and Home → Products → Product → Contact, desktop + mobile.
