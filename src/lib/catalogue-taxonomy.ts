// Product types and collections as the public pages show them. The lists bundled with the
// site are the starting value and stay in use while the API is unavailable or has none;
// an API answer replaces them, so what an admin adds, renames or hides shows up here.
import { useEffect, useSyncExternalStore } from "react";
import {
  collections as bundledCollections,
  productTypes as bundledTypes,
  type Collection,
  type Localized,
  type ProductType,
} from "@/data/catalogue";
import {
  getPublicCollections,
  getPublicProductTypes,
  type PublicCollectionShape,
  type PublicProductTypeShape,
} from "./content-api";

export type TypeView = Omit<ProductType, "id"> & { id: string };
export type CollectionView = Omit<Collection, "id"> & { id: string };
export type Taxonomy = { productTypes: TypeView[]; collections: CollectionView[] };

const bundled: Taxonomy = { productTypes: bundledTypes, collections: bundledCollections };
let current = bundled;
const listeners = new Set<() => void>();

function localized(api: PublicCollectionShape, field: string, fallback: string): Localized {
  const vi = api.translations?.vi?.[field] || fallback;
  return { vi, en: api.translations?.en?.[field] || vi };
}

function toType(api: PublicProductTypeShape): TypeView {
  const name = localized(api, "name", api.name);
  return {
    id: api.code,
    slug: api.slug,
    name,
    plural: {
      vi: api.translations?.vi?.plural || name.vi,
      en: api.translations?.en?.plural || name.en,
    },
    tagline: localized(api, "tagline", api.tagline),
    image: api.image ?? bundledTypes.find((t) => t.id === api.code)?.image,
  };
}

function toCollection(api: PublicCollectionShape): CollectionView {
  return {
    id: api.slug,
    slug: api.slug,
    name: localized(api, "name", api.name),
    tagline: localized(api, "tagline", ""),
    // Before collections had translations, the description held the intro.
    intro: localized(api, "intro", api.tagline),
    image: api.image ?? bundledCollections.find((c) => c.id === api.slug)?.image,
  };
}

const FRESH_FOR_MS = 60_000;
let pending: Promise<void> | undefined;
let loadedAt = 0;

/** Reads both lists from the API, at most once a minute. Never rejects. */
export function loadTaxonomy(): Promise<void> {
  if (pending && loadedAt && Date.now() - loadedAt > FRESH_FOR_MS) pending = undefined;
  pending ??= Promise.all([getPublicProductTypes(), getPublicCollections()]).then(
    ([types, collections]) => {
      if (!types && !collections) {
        // Unavailable: keep what is shown and ask again on the next call.
        pending = undefined;
        return;
      }
      loadedAt = Date.now();
      current = {
        productTypes: types?.length ? types.map(toType) : current.productTypes,
        collections: collections?.length ? collections.map(toCollection) : current.collections,
      };
      for (const notify of listeners) notify();
    },
  );
  return pending;
}

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => void listeners.delete(notify);
};

/** The lists for a component; it renders again when the API answer arrives. */
export function useTaxonomy(): Taxonomy {
  useEffect(() => void loadTaxonomy(), []);
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => bundled,
  );
}

export const taxonomy = (): Taxonomy => current;

const own = (id: string): Localized => ({ vi: id, en: id });
const none: Localized = { vi: "", en: "" };

/** A type or collection outside the lists is labelled with its own id. */
export const getProductType = (id: string): TypeView =>
  current.productTypes.find((t) => t.id === id) ?? {
    id,
    slug: id,
    name: own(id),
    plural: own(id),
    tagline: none,
  };
export const getProductTypeBySlug = (slug: string) =>
  current.productTypes.find((t) => t.slug === slug);
export const getCollection = (id: string): CollectionView =>
  current.collections.find((c) => c.id === id) ?? {
    id,
    slug: id,
    name: own(id),
    tagline: none,
    intro: none,
  };
export const getCollectionBySlug = (slug: string) =>
  current.collections.find((c) => c.slug === slug);

/** Tests only: back to the bundled lists. */
export function resetTaxonomy() {
  current = bundled;
  pending = undefined;
  loadedAt = 0;
}
