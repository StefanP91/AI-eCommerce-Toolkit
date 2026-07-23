type ShopifyAdmin = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

/** Human store name for AI copy (never "[Store Name]"). */
export async function fetchShopDisplayName(
  admin: ShopifyAdmin,
  shopDomain?: string,
): Promise<string> {
  try {
    const response = await admin.graphql(
      `#graphql
        query ShopDisplayName {
          shop {
            name
          }
        }`,
    );
    const json = await response.json();
    const name = String(json.data?.shop?.name || "").trim();
    if (name) return name;
  } catch {
    /* fall through */
  }

  const fromDomain = (shopDomain || "")
    .replace(/\.myshopify\.com$/i, "")
    .replace(/-/g, " ")
    .trim();
  if (!fromDomain) return "our store";
  return fromDomain.replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Strip common AI placeholders with the real store name. */
export function replaceStorePlaceholders(
  value: string,
  storeName: string,
): string {
  return value
    .replace(/\[Store Name\]/gi, storeName)
    .replace(/\[Shop Name\]/gi, storeName)
    .replace(/\[Your Store\]/gi, storeName)
    .replace(/\{Store Name\}/gi, storeName)
    .replace(/\{Shop Name\}/gi, storeName);
}
