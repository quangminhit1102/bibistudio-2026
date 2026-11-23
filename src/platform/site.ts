// The only core module allowed to import from `@site/*`.
import catalogueConfig from "@site/catalogue.config";
import config from "@site/site.config";

export const site = config;
export const catalogue = catalogueConfig;
export { BrandLogo, BrandMark } from "@site/assets/brand-logo";
