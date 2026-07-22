import { generateProductContent } from "./ai.server";

type ShopifyAdmin = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type OptimizeProductResult =
  | {
      ok: true;
      productId: string;
      title: string;
      generated: {
        title: string;
        metaTitle: string;
        metaDescription: string;
      };
    }
  | {
      ok: false;
      productId: string;
      error: string;
    };

export async function optimizeProductById(
  admin: ShopifyAdmin,
  productId: string,
): Promise<OptimizeProductResult> {
  const productResponse = await admin.graphql(
    `#graphql
      query OneProduct($id: ID!) {
        product(id: $id) {
          id
          title
          descriptionHtml
        }
      }`,
    { variables: { id: productId } },
  );

  const productJson = await productResponse.json();
  const product = productJson.data?.product;

  if (!product) {
    return { ok: false, productId, error: "Product not found" };
  }

  let generated;
  try {
    generated = await generateProductContent({
      title: product.title,
      descriptionHtml: product.descriptionHtml || "",
    });
  } catch (error) {
    return {
      ok: false,
      productId,
      error: error instanceof Error ? error.message : "AI generation failed",
    };
  }

  const updateResponse = await admin.graphql(
    `#graphql
      mutation UpdateProductContent($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product {
            id
            title
            descriptionHtml
            seo {
              title
              description
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        product: {
          id: productId,
          title: generated.title,
          descriptionHtml: generated.descriptionHtml,
          seo: {
            title: generated.metaTitle,
            description: generated.metaDescription,
          },
        },
      },
    },
  );

  const updateJson = await updateResponse.json();
  const errors = updateJson.data?.productUpdate?.userErrors || [];

  if (errors.length > 0) {
    return {
      ok: false,
      productId,
      error: errors.map((e: { message: string }) => e.message).join(", "),
    };
  }

  return {
    ok: true,
    productId,
    title: updateJson.data?.productUpdate?.product?.title || generated.title,
    generated: {
      title: generated.title,
      metaTitle: generated.metaTitle,
      metaDescription: generated.metaDescription,
    },
  };
}
