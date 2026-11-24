// The only core module allowed to import from `@site/*`.
import catalogueConfig from "@site/catalogue.config";
import siteMessages from "@site/messages/vi";
import config from "@site/site.config";

export const site = config;
export const catalogue = catalogueConfig;
export const messages = siteMessages;
export { BrandLogo, BrandMark } from "@site/assets/brand-logo";
