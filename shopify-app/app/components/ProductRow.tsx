import type { useAppBridge } from "@shopify/app-bridge-react";
import { scoreProduct, type ProductNode } from "../lib/products";

export function ProductRow({
  product,
  selected,
  onToggleSelected,
  selectionDisabled,
  isBusy,
  thisLoading,
  onGenerate,
  shopify,
}: {
  product: ProductNode;
  selected: boolean;
  onToggleSelected: (productId: string) => void;
  selectionDisabled: boolean;
  isBusy: boolean;
  thisLoading: boolean;
  onGenerate: (productId: string) => void;
  shopify: ReturnType<typeof useAppBridge>;
}) {
  const score = scoreProduct(product);

  return (
    <div className={`dashboard-product-row${selected ? " is-selected" : ""}`}>
      <div className="dashboard-product-main">
        <label className="dashboard-product-check">
          <input
            type="checkbox"
            checked={selected}
            disabled={selectionDisabled && !selected}
            onChange={() => onToggleSelected(product.id)}
            aria-label={`Select ${product.title}`}
          />
        </label>
        <div className="dashboard-product-thumb">
          {product.featuredImage?.url ? (
            <img
              src={product.featuredImage.url}
              alt={product.featuredImage.altText || product.title}
            />
          ) : (
            <div className="dashboard-product-thumb-placeholder" aria-hidden>
              No image
            </div>
          )}
        </div>
        <div className="dashboard-product-copy">
          <strong>{product.title}</strong>
          <div className="dashboard-product-meta">
            {product.status} · SEO score {score}/100
            {product.seo?.title ? ` · ${product.seo.title}` : " · No meta title"}
          </div>
        </div>
      </div>
      <div className="dashboard-product-actions">
        <button
          type="button"
          className="dashboard-btn dashboard-btn-primary"
          disabled={isBusy}
          onClick={() => onGenerate(product.id)}
        >
          {thisLoading ? "Generating..." : "Generate with AI"}
        </button>
        <button
          type="button"
          className="dashboard-btn dashboard-btn-ghost"
          disabled={isBusy}
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
