import type { ProductNode } from "./products";

export async function fetchProducts(admin: {
  graphql: (query: string, options?: { variables?: Record<string, string> }) => Promise<Response>;
}): Promise<ProductNode[]> {
  const response = await admin.graphql(
    `#graphql
      query ProductList {
        products(first: 50, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              title
              handle
              descriptionHtml
              status
              seo {
                title
                description
              }
            }
          }
        }
      }`,
  );

  const json = await response.json();
  return (
    json.data?.products?.edges?.map((edge: { node: ProductNode }) => edge.node) ?? []
  );
}
