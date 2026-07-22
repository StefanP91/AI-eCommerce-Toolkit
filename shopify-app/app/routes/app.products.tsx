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
import {
  fetchProducts,
  scoreProduct,
  type ProductNode,
} from "../lib/products.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const products = await fetchProducts(admin);

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

function ProductRow({
  product,
  fetcher,
  isLoading,
  loadingProductId,
  shopify,
}: {
  product: ProductNode;
  fetcher: ReturnType<typeof useFetcher<typeof action>>;
  isLoading: boolean;
  loadingProductId: string;
  shopify: ReturnType<typeof useAppBridge>;
}) {
  const thisLoading = loadingProductId === product.id;
  const score = scoreProduct(product);

  return (
    <div className="dashboard-product-row">
      <div>
        <strong>{product.title}</strong>
        <div className="dashboard-product-meta">
          {product.status} · SEO score {score}/100
          {product.seo?.title ? ` · ${product.seo.title}` : " · No meta title"}
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <fetcher.Form method="post">
          <input type="hidden" name="productId" value={product.id} />
          <button
            type="submit"
            className="dashboard-btn dashboard-btn-primary"
            disabled={isLoading && !thisLoading}
          >
            {thisLoading ? "Generating..." : "Generate with AI"}
          </button>
        </fetcher.Form>
        <button
          type="button"
          className="dashboard-btn dashboard-btn-ghost"
          onClick={() => {
            shopify.intents.invoke?.("edit:shopify/Product", {
              value: product.id,
            });
          }}
        >
          Open
        </button>
      </div>
    </div>
  );
}

export default function ProductsPage() {
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
    <>
      <div className="dashboard-topbar">
        <div>
          <h1>Products</h1>
          <p>Generate titles, descriptions, and SEO meta with one click</p>
        </div>
      </div>

      {!aiConfigured && (
        <div className="dashboard-warning">
          Add <code>GEMINI_API_KEY</code> to <code>shopify-app/.env</code> for full AI
          generation.
        </div>
      )}

      <div className="dashboard-products">
        {products.length === 0 ? (
          <div className="dashboard-card">
            No products yet. Create a product in Shopify Admin, then refresh.
          </div>
        ) : (
          products.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              fetcher={fetcher}
              isLoading={isLoading}
              loadingProductId={loadingProductId}
              shopify={shopify}
            />
          ))
        )}
      </div>

      {fetcher.data?.ok && fetcher.data.generated && (
        <section className="dashboard-card" style={{ marginTop: "1rem" }}>
          <h2>Last result</h2>
          <p>
            <strong>Title:</strong> {fetcher.data.generated.title}
          </p>
          <p>
            <strong>Meta title:</strong> {fetcher.data.generated.metaTitle}
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>Meta description:</strong>{" "}
            {fetcher.data.generated.metaDescription}
          </p>
        </section>
      )}
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
