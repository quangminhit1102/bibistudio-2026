import type { SiteConfig, SiteLocation, SocialLink } from "@/platform/site-contract";

type WithContact = Pick<SiteConfig, "contact">;

export const telHref = (site: WithContact): string => `tel:${site.contact.phone}`;

export const mailHref = (site: WithContact): string => `mailto:${site.contact.email}`;

export const socialLink = (site: WithContact, id: string): SocialLink | undefined =>
  site.contact.social.find((link) => link.id === id);

export function mapLinks(location: SiteLocation) {
  const query = encodeURIComponent(location.query);
  return {
    embed: `https://www.google.com/maps?q=${query}&z=16&output=embed`,
    maps: `https://www.google.com/maps/search/?api=1&query=${query}`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
  };
}

export function siteLocation(site: WithContact) {
  const location = site.contact.location;
  return location ? { ...location, ...mapLinks(location) } : undefined;
}
