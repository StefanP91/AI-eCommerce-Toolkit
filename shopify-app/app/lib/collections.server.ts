import { callGeminiJson, clip, clean, isGeminiConfigured } from "./gemini.server";
import { logActivityRun } from "./activity.server";
import { recordAiUsageIfFree, requireAiAccess } from "./billing.server";
import { merchantAiError } from "./merchant-errors";

type ShopifyAdmin = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type CollectionNode = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  image: { url: string; altText: string | null } | null;
  seo: { title: string | null; description: string | null };
};

export async function fetchCollections(
  admin: ShopifyAdmin,
  search = "",
): Promise<CollectionNode[]> {
  const query = search.trim() || null;
  const response = await admin.graphql(
    `#graphql
      query CollectionList($query: String) {
        collections(first: 50, query: $query, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              title
              handle
              descriptionHtml
              image {
                url
                altText
              }
              seo {
                title
                description
              }
            }
          }
        }
      }`,
    { variables: { query } },
  );

  const json = await response.json();
  return (
    json.data?.collections?.edges?.map(
      (edge: { node: CollectionNode }) => edge.node,
    ) ?? []
  );
}

export async function optimizeCollectionById(
  admin: ShopifyAdmin,
  collectionId: string,
  shop?: string,
): Promise<
  | {
      ok: true;
      collectionId: string;
      title: string;
      generated: { title: string; descriptionHtml: string; metaTitle: string; metaDescription: string };
    }
  | {
      ok: false;
      collectionId: string;
      title?: string;
      error: string;
      code?: "quota_exceeded";
      used?: number;
      limit?: number;
    }
> {
  const access = await requireAiAccess(shop);
  if (!access.allowed) {
    const result = {
      ok: false as const,
      collectionId,
      error: access.deny.error,
      code: access.deny.code,
      used: access.deny.used,
      limit: access.deny.limit,
    };
    if (shop) {
      await logActivityRun({
        shop,
        resource: "collection",
        resourceId: collectionId,
        title: "Collection",
        action: "collection_optimize",
        status: "Fail",
        error: result.error,
      });
    }
    return result;
  }

  const response = await admin.graphql(
    `#graphql
      query OneCollection($id: ID!) {
        collection(id: $id) {
          id
          title
          descriptionHtml
          seo {
            title
            description
          }
        }
      }`,
    { variables: { id: collectionId } },
  );

  const json = await response.json();
  const collection = json.data?.collection;

  if (!collection) {
    const result = {
      ok: false as const,
      collectionId,
      error: "Collection not found",
    };
    if (shop) {
      await logActivityRun({
        shop,
        resource: "collection",
        resourceId: collectionId,
        title: "Collection",
        action: "collection_optimize",
        status: "Fail",
        error: result.error,
      });
    }
    return result;
  }

  let generated: {
    title: string;
    descriptionHtml: string;
    metaTitle: string;
    metaDescription: string;
  };

  try {
    if (!isGeminiConfigured()) {
      generated = {
        title: clip(clean(collection.title), 70),
        descriptionHtml:
          collection.descriptionHtml ||
          `<p>Shop our ${collection.title} collection.</p>`,
        metaTitle: clip(clean(collection.seo?.title || collection.title), 60),
        metaDescription: clip(
          clean(
            collection.seo?.description ||
              `Explore ${collection.title}. Quality products curated for you.`,
          ),
          155,
        ),
      };
    } else {
      const parsed = await callGeminiJson({
        temperature: 0.55,
        system:
          'You write SEO collection copy for Shopify. Return JSON: {"title":"...","descriptionHtml":"<p>...</p>","metaTitle":"...","metaDescription":"..."}',
        prompt: `Improve this Shopify collection for SEO.
Current title: ${collection.title}
Current description: ${(collection.descriptionHtml || "").replace(/<[^>]+>/g, " ").slice(0, 600)}
Rules:
- title max 70 chars
- metaTitle 30-60 chars
- metaDescription 120-155 chars
- descriptionHtml with short <p> and optional <ul><li>`,
      });

      generated = {
        title: clip(clean(String(parsed.title || collection.title)), 70),
        descriptionHtml: String(
          parsed.descriptionHtml ||
            `<p>Discover our ${collection.title} collection.</p>`,
        ),
        metaTitle: clip(
          clean(String(parsed.metaTitle || parsed.title || collection.title)),
          60,
        ),
        metaDescription: clip(
          clean(
            String(
              parsed.metaDescription ||
                `Shop ${collection.title}. Curated products with great value.`,
            ),
          ),
          155,
        ),
      };
    }
  } catch (error) {
    const result = {
      ok: false as const,
      collectionId,
      title: collection.title,
      error: merchantAiError(error),
    };
    if (shop) {
      await logActivityRun({
        shop,
        resource: "collection",
        resourceId: collectionId,
        title: collection.title,
        action: "collection_optimize",
        status: "Fail",
        error: result.error,
      });
    }
    return result;
  }

  const updateResponse = await admin.graphql(
    `#graphql
      mutation UpdateCollection($input: CollectionInput!) {
        collectionUpdate(input: $input) {
          collection {
            id
            title
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        input: {
          id: collectionId,
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
  const errors = updateJson.data?.collectionUpdate?.userErrors || [];

  if (errors.length > 0) {
    const result = {
      ok: false as const,
      collectionId,
      title: collection.title,
      error: errors.map((e: { message: string }) => e.message).join(", "),
    };
    if (shop) {
      await logActivityRun({
        shop,
        resource: "collection",
        resourceId: collectionId,
        title: collection.title,
        action: "collection_optimize",
        status: "Fail",
        error: result.error,
      });
    }
    return result;
  }

  const result = {
    ok: true as const,
    collectionId,
    title:
      updateJson.data?.collectionUpdate?.collection?.title || generated.title,
    generated,
  };

  await recordAiUsageIfFree(shop);

  if (shop) {
    await logActivityRun({
      shop,
      resource: "collection",
      resourceId: collectionId,
      title: result.title,
      action: "collection_optimize",
      status: "Success",
    });
  }

  return result;
}
