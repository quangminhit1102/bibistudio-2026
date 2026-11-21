export function resolveSeo(input: {
  seoTitle?: string;
  seoDescription?: string;
  title: string;
  excerpt?: string;
  shortDescription?: string;
}): { title: string; description: string } {
  const fallbackDescription = input.excerpt?.trim() || input.shortDescription?.trim() || "";
  return {
    title: (input.seoTitle?.trim() || input.title).trim(),
    description: (input.seoDescription?.trim() || fallbackDescription).trim(),
  };
}
