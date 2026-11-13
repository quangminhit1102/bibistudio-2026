import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Reader, CountryResponse } from "maxmind";
import ipaddr from "ipaddr.js";
export type Country = Readonly<{ code: string; name: string; dataset: string }>;
export interface CountryLookup {
  lookup(ip: string): Country | null;
  close(): void;
}
type CountryReader = {
  get(ip: string): { country?: { iso_code?: string; names?: { en?: string } } } | null;
};
/** Independent bounded cache for one immutable, integrity-checked dataset. */
export function createCountryLookup(initialReader: CountryReader, version: string): CountryLookup {
  let reader: CountryReader | null = initialReader;
  const cache = new Map<string, Country | null>();
  return {
    lookup(ip) {
      if (!reader || !ip || /[%\s,]/.test(ip)) return null;
      let address: string;
      try {
        const parsed = ipaddr.process(ip);
        if (parsed.range() !== "unicast") return null;
        address = parsed.toString();
      } catch {
        return null;
      }
      const key = version + "\n" + address;
      if (cache.has(key)) {
        const value = cache.get(key)!;
        cache.delete(key);
        cache.set(key, value);
        return value;
      }
      let country: Country | null = null;
      try {
        const data = reader.get(address)?.country;
        if (
          data?.iso_code &&
          /^[A-Z]{2}$/.test(data.iso_code) &&
          data.names?.en &&
          data.names.en.length <= 128
        )
          country = Object.freeze({ code: data.iso_code, name: data.names.en, dataset: version });
      } catch {
        /* A lookup miss never prevents collecting a visitor batch. */
      }
      cache.set(key, country);
      if (cache.size > 1024) cache.delete(cache.keys().next().value!);
      return country;
    },
    close() {
      cache.clear();
      reader = null;
    },
  };
}
export async function openCountryLookup({
  file,
  sha256,
  version,
}: {
  file: string | URL;
  sha256: string;
  version: string;
}): Promise<CountryLookup> {
  return validatedLookup(await readFile(file), sha256, version);
}
/** Adapter for the existing synchronous runtime factory; shares the same validation. */
export function openCountryLookupSync({
  file,
  sha256,
  version,
}: {
  file: string;
  sha256: string;
  version: string;
}): CountryLookup {
  return validatedLookup(readFileSync(file), sha256, version);
}
function validatedLookup(bytes: Buffer, sha256: string, version: string): CountryLookup {
  if (!/^[a-f0-9]{64}$/.test(sha256) || createHash("sha256").update(bytes).digest("hex") !== sha256)
    throw new Error("Country MMDB checksum mismatch");
  if (!version || version.length > 80) throw new Error("Invalid country dataset version");
  // Construct from the exact validated buffer: no second read or watcher can replace it.
  return createCountryLookup(new Reader<CountryResponse>(bytes), version);
}
