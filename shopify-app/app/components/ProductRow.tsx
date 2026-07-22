import type { useFetcher } from "react-router";
import type { useAppBridge } from "@shopify/app-bridge-react";
import { scoreProduct, type ProductNode } from "../lib/products";

type ProductsAction = {
  ok: boolean;
  error?: string;
  generated?: {
    title: string;
    metaTitle: string;
    metaDescription: string;
  };
};

export function ProductRow({
  product,
  fetcher,
  isLoading,
  loadingProductId,
  shopify,
}: {
  product: ProductNode;
  fetcher: ReturnType<typeof useFetcher<ProductsAction>>;
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
