// The only core module allowed to import from `@site/*`.
import config from "@site/site.config";

export const site = config;
export { BrandLogo, BrandMark } from "@site/assets/brand-logo";
