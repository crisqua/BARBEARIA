export function tenantBrandingCacheKey(slug: string): string {
  return `tenant:slug:${slug}`;
}
