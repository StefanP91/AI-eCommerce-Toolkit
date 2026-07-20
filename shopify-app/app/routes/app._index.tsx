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
import { buildSeoFromProduct } from "../lib/seo.server";

type ProductNode = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  status: string;
  onlineStoreUrl: string | null;
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
        products(first: 15, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              title
              handle
              descriptionHtml
              status
              onlineStoreUrl
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
    webUrl: process.env.AI_COMMERCE_WEB_URL || "https://ai-ecommerce-suite.netlify.app",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const productId = String(formData.get("productId") || "");

  if (!productId) {
    return { ok: false, error: "Missing product id" };
  }

  const productResponse = await admin.graphql(
    `#graphql
      query OneProduct($id: ID!) {
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
    return { ok: false, error: "Product not found" };
  }

  const seo = buildSeoFromProduct({
    title: product.title,
    descriptionHtml: product.descriptionHtml || "",
  });

  const updateResponse = await admin.graphql(
    `#graphql
      mutation UpdateProductSeo($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product {
            id
            title
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
          seo: {
            title: seo.metaTitle,
            description: seo.metaDescription,
          },
        },
      },
    },
  );

  const updateJson = await updateResponse.json();
  const errors = updateJson.data?.productUpdate?.userErrors || [];

  if (errors.length > 0) {
    return { ok: false, error: errors.map((e: { message: string }) => e.message).join(", ") };
  }

  return {
    ok: true,
    product: updateJson.data?.productUpdate?.product,
    seo,
  };
};

export default function Index() {
  const { products, webUrl } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("SEO meta updated");
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  return (
    <s-page heading="AI Commerce Suite">
      <s-button slot="primary-action" href={webUrl} target="_blank">
        Open full web app
      </s-button>

      <s-section heading="Optimize product SEO from Shopify Admin">
        <s-paragraph>
          This embedded app lists products from your store. Use{" "}
          <strong>Optimize SEO</strong> to write meta title and description
          directly on the product. Full AI generation, bulk upload, and store
          audit live in the web app.
        </s-paragraph>
      </s-section>

      <s-section heading="Recent products">
        {products.length === 0 ? (
          <s-paragraph>
            No products found. Add a product in Shopify Admin, then refresh.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {products.map((product) => (
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
                    Status: {product.status}
                    {product.seo?.title ? ` · Meta: ${product.seo.title}` : " · No SEO title yet"}
                  </s-paragraph>
                  <s-stack direction="inline" gap="base">
                    <fetcher.Form method="post">
                      <input type="hidden" name="productId" value={product.id} />
                      <s-button
                        type="submit"
                        {...(isLoading ? { loading: true } : {})}
                      >
                        Optimize SEO
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
                      Edit in Shopify
                    </s-button>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>

      {fetcher.data?.ok && fetcher.data.seo && (
        <s-section heading="Last optimization">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(fetcher.data.seo, null, 2)}
            </pre>
          </s-box>
        </s-section>
      )}

      <s-section slot="aside" heading="What this app does">
        <s-unordered-list>
          <s-list-item>Read products from your store</s-list-item>
          <s-list-item>Write SEO title &amp; description</s-list-item>
          <s-list-item>Ready for App Store embedding</s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Next">
        <s-paragraph>
          Connect this app to the Laravel AI API for full product copy
          generation (titles, FAQs, schema, bulk).
        </s-paragraph>
        <s-link href={webUrl} target="_blank">
          {webUrl}
        </s-link>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
