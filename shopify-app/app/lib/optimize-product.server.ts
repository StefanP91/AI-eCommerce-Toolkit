import { generateProductContent } from "./ai.server";
import {
  generateImageAltText,
  translateProductContent,
} from "./ai-tools.server";
import { logActivityRun, type ActivityAction } from "./activity.server";
import { recordAiUsageIfFree, requireAiAccess } from "./billing.server";
import { merchantAiError } from "./merchant-errors";
import { fetchShopDisplayName } from "./shop-name.server";

type ShopifyAdmin = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type ProductActionResult =
  | {
      ok: true;
      productId: string;
      title: string;
      generated?: {
        title: string;
        metaTitle: string;
        metaDescription: string;
      };
      altText?: string;
    }
  | {
      ok: false;
      productId: string;
      title?: string;
      error: string;
      code?: "quota_exceeded";
      used?: number;
      limit?: number;
    };

async function record(
  shop: string | undefined,
  result: ProductActionResult,
  action: ActivityAction,
) {
  if (!shop) return;
  await logActivityRun({
    shop,
    resource: "product",
    resourceId: result.productId,
    title: result.ok ? result.title : result.title || "Product",
    action,
    status: result.ok ? "Success" : "Fail",
    error: result.ok ? undefined : result.error,
  });
}

export async function optimizeProductById(
  admin: ShopifyAdmin,
  productId: string,
  shop?: string,
): Promise<ProductActionResult> {
  const access = await requireAiAccess(shop);
  if (!access.allowed) {
    const result = {
      ok: false as const,
      productId,
      error: access.deny.error,
      code: access.deny.code,
      used: access.deny.used,
      limit: access.deny.limit,
    };
    await record(shop, result, "optimize");
    return result;
  }

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
    const result = {
      ok: false as const,
      productId,
      error: "Product not found",
    };
    await record(shop, result, "optimize");
    return result;
  }

  let generated;
  try {
    const storeName = await fetchShopDisplayName(admin, shop);
    generated = await generateProductContent({
      title: product.title,
      descriptionHtml: product.descriptionHtml || "",
      storeName,
    });
  } catch (error) {
    const result = {
      ok: false as const,
      productId,
      title: product.title,
      error: merchantAiError(error),
    };
    await record(shop, result, "optimize");
    return result;
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
    const result = {
      ok: false as const,
      productId,
      title: product.title,
      error: errors.map((e: { message: string }) => e.message).join(", "),
    };
    await record(shop, result, "optimize");
    return result;
  }

  const result = {
    ok: true as const,
    productId,
    title: updateJson.data?.productUpdate?.product?.title || generated.title,
    generated: {
      title: generated.title,
      metaTitle: generated.metaTitle,
      metaDescription: generated.metaDescription,
    },
  };
  await recordAiUsageIfFree(shop);
  await record(shop, result, "optimize");
  return result;
}

export async function translateProductById(
  admin: ShopifyAdmin,
  productId: string,
  options: { sourceLanguage: string; targetLanguage: string; shop?: string },
): Promise<ProductActionResult> {
  const access = await requireAiAccess(options.shop);
  if (!access.allowed) {
    const result = {
      ok: false as const,
      productId,
      error: access.deny.error,
      code: access.deny.code,
      used: access.deny.used,
      limit: access.deny.limit,
    };
    await record(options.shop, result, "translate");
    return result;
  }

  const productResponse = await admin.graphql(
    `#graphql
      query OneProductTranslate($id: ID!) {
        product(id: $id) {
          id
          title
          descriptionHtml
          seo {
            title
            description
          }
        }
      }`,
    { variables: { id: productId } },
  );

  const productJson = await productResponse.json();
  const product = productJson.data?.product;

  if (!product) {
    const result = {
      ok: false as const,
      productId,
      error: "Product not found",
    };
    await record(options.shop, result, "translate");
    return result;
  }

  let translated;
  try {
    translated = await translateProductContent({
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
      fields: {
        title: product.title,
        descriptionHtml: product.descriptionHtml || "",
        metaTitle: product.seo?.title || product.title,
        metaDescription: product.seo?.description || "",
      },
    });
  } catch (error) {
    const result = {
      ok: false as const,
      productId,
      title: product.title,
      error: merchantAiError(error),
    };
    await record(options.shop, result, "translate");
    return result;
  }

  const updateResponse = await admin.graphql(
    `#graphql
      mutation ApplyBulkTranslation($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product { id title }
          userErrors { message }
        }
      }`,
    {
      variables: {
        product: {
          id: productId,
          title: translated.title,
          descriptionHtml: translated.descriptionHtml,
          seo: {
            title: translated.metaTitle,
            description: translated.metaDescription,
          },
        },
      },
    },
  );

  const updateJson = await updateResponse.json();
  const errors = updateJson.data?.productUpdate?.userErrors || [];

  if (errors.length > 0) {
    const result = {
      ok: false as const,
      productId,
      title: product.title,
      error: errors.map((e: { message: string }) => e.message).join(", "),
    };
    await record(options.shop, result, "translate");
    return result;
  }

  const result = {
    ok: true as const,
    productId,
    title: updateJson.data?.productUpdate?.product?.title || translated.title,
    generated: {
      title: translated.title,
      metaTitle: translated.metaTitle,
      metaDescription: translated.metaDescription,
    },
  };
  await recordAiUsageIfFree(options.shop);
  await record(options.shop, result, "translate");
  return result;
}

export async function altProductById(
  admin: ShopifyAdmin,
  productId: string,
  shop?: string,
): Promise<ProductActionResult> {
  const access = await requireAiAccess(shop);
  if (!access.allowed) {
    const result = {
      ok: false as const,
      productId,
      error: access.deny.error,
      code: access.deny.code,
      used: access.deny.used,
      limit: access.deny.limit,
    };
    await record(shop, result, "alt");
    return result;
  }

  const productResponse = await admin.graphql(
    `#graphql
      query OneProductAlt($id: ID!) {
        product(id: $id) {
          id
          title
          featuredMedia {
            id
            preview {
              image {
                url
                altText
              }
            }
          }
          featuredImage {
            url
            altText
          }
        }
      }`,
    { variables: { id: productId } },
  );

  const productJson = await productResponse.json();
  const product = productJson.data?.product;

  if (!product) {
    const result = {
      ok: false as const,
      productId,
      error: "Product not found",
    };
    await record(shop, result, "alt");
    return result;
  }

  const mediaId = product.featuredMedia?.id || null;
  const imageUrl =
    product.featuredImage?.url ||
    product.featuredMedia?.preview?.image?.url ||
    null;

  if (!mediaId) {
    const result = {
      ok: false as const,
      productId,
      title: product.title,
      error: "No product image to update",
    };
    await record(shop, result, "alt");
    return result;
  }

  let altResult;
  try {
    altResult = await generateImageAltText({
      productName: product.title,
      imageUrl,
    });
  } catch (error) {
    const result = {
      ok: false as const,
      productId,
      title: product.title,
      error: merchantAiError(error),
    };
    await record(shop, result, "alt");
    return result;
  }

  const updateResponse = await admin.graphql(
    `#graphql
      mutation ApplyBulkAlt($productId: ID!, $media: [UpdateMediaInput!]!) {
        productUpdateMedia(productId: $productId, media: $media) {
          media {
            ... on MediaImage {
              id
              alt
            }
          }
          userErrors { message }
        }
      }`,
    {
      variables: {
        productId,
        media: [{ id: mediaId, alt: altResult.altText }],
      },
    },
  );

  const updateJson = await updateResponse.json();
  const errors = updateJson.data?.productUpdateMedia?.userErrors || [];

  if (errors.length > 0) {
    const result = {
      ok: false as const,
      productId,
      title: product.title,
      error: errors.map((e: { message: string }) => e.message).join(", "),
    };
    await record(shop, result, "alt");
    return result;
  }

  const result = {
    ok: true as const,
    productId,
    title: product.title,
    altText: altResult.altText,
  };
  await recordAiUsageIfFree(shop);
  await record(shop, result, "alt");
  return result;
}
