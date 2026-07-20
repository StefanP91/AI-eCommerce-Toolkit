import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { generateProductContent } from "../lib/ai.server";

type ProductNode = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  status: string;
  seo: {
    title: string | null;
    description: string | null;
  };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
      query ProductList {
        products(first: 25, sortKey: UPDATED_AT, reverse: true) {
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
  const products: ProductNode[] =
    json.data?.products?.edges?.map((edge: { node: ProductNode }) => edge.node) ??
    [];

  return {
    products,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const productId = String(formData.get("productId") || "");

  if (!productId) {
    return { ok: false as const, error: "Missing product id" };
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
    return { ok: false as const, error: "Product not found" };
  }

  let generated;
  try {
    generated = await generateProductContent({
      title: product.title,
      descriptionHtml: product.descriptionHtml || "",
    });
  } catch (error) {
    return {
      ok: false as const,
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
      ok: false as const,
      error: errors.map((e: { message: string }) => e.message).join(", "),
    };
  }

  return {
    ok: true as const,
    product: updateJson.data?.productUpdate?.product,
    generated,
  };
};

export default function Index() {
  const { products, aiConfigured } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const loadingProductId =
    isLoading && fetcher.formData
      ? String(fetcher.formData.get("productId") || "")
      : "";

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Product optimized with AI");
    } else if (fetcher.data && "error" in fetcher.data && fetcher.data.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  return (
    <s-page heading="AI Commerce Suite">
      <s-section heading="AI product optimizer">
        <s-paragraph>
          Optimize your Shopify products directly in Admin — titles,
          descriptions, and SEO meta. No external website required.
        </s-paragraph>
        {!aiConfigured && (
          <s-banner tone="warning">
            Add <code>GEMINI_API_KEY</code> to <code>shopify-app/.env</code> for
            full AI generation. Until then, a basic SEO fallback is used.
          </s-banner>
        )}
      </s-section>

      <s-section heading="Your products">
        {products.length === 0 ? (
          <s-paragraph>
            No products yet. Create a product in Shopify, then come back here.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {products.map((product) => {
              const thisLoading = loadingProductId === product.id;
              return (
                <s-box
                  key={product.id}
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                  background="subdued"
                >
                  <s-stack direction="block" gap="small">
                    <s-heading>{product.title}</s-heading>
                    <s-paragraph>
                      {product.status}
                      {product.seo?.title
                        ? ` · SEO: ${product.seo.title}`
                        : " · No SEO title"}
                    </s-paragraph>
                    <s-stack direction="inline" gap="base">
                      <fetcher.Form method="post">
                        <input type="hidden" name="productId" value={product.id} />
                        <s-button
                          type="submit"
                          variant="primary"
                          {...(thisLoading ? { loading: true } : {})}
                          {...(isLoading && !thisLoading ? { disabled: true } : {})}
                        >
                          Generate &amp; apply AI content
                        </s-button>
                      </fetcher.Form>
                      <s-button
                        variant="tertiary"
                        onClick={() => {
                          shopify.intents.invoke?.("edit:shopify/Product", {
                            value: product.id,
                          });
                        }}
                      >
                        Open product
                      </s-button>
                    </s-stack>
                  </s-stack>
                </s-box>
              );
            })}
          </s-stack>
        )}
      </s-section>

      {fetcher.data?.ok && fetcher.data.generated && (
        <s-section heading="Last result">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small">
              <s-paragraph>
                <strong>Title:</strong> {fetcher.data.generated.title}
              </s-paragraph>
              <s-paragraph>
                <strong>Meta title:</strong> {fetcher.data.generated.metaTitle}
              </s-paragraph>
              <s-paragraph>
                <strong>Meta description:</strong>{" "}
                {fetcher.data.generated.metaDescription}
              </s-paragraph>
            </s-stack>
          </s-box>
        </s-section>
      )}

      <s-section slot="aside" heading="Runs inside Shopify">
        <s-unordered-list>
          <s-list-item>Install once on your store</s-list-item>
          <s-list-item>Generate AI copy in Admin</s-list-item>
          <s-list-item>Writes title, description &amp; SEO</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
