import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { fetchProductsPage } from "../lib/products.server";
import { parseProductSort } from "../lib/products";
import { optimizeProductById } from "../lib/optimize-product.server";
import { ProductRow } from "../components/ProductRow";
import { ProductsPagination } from "../components/ProductsPagination";
import { ProductsSearch } from "../components/ProductsSearch";
import { ProductsSort } from "../components/ProductsSort";

export const MAX_BULK_OPTIMIZE = 20;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
  const search = (url.searchParams.get("q") || "").trim();
  const sort = parseProductSort(url.searchParams.get("sort"));
  const productsPage = await fetchProductsPage(admin, page, search, sort);

  return {
    ...productsPage,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    maxBulk: MAX_BULK_OPTIMIZE,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "single");

  if (intent === "bulk") {
    const productIds = formData
      .getAll("productIds")
      .map((value) => String(value))
      .filter(Boolean)
      .slice(0, MAX_BULK_OPTIMIZE);

    if (productIds.length === 0) {
      return { ok: false as const, error: "Select at least one product" };
    }

    const results = [];
    for (const productId of productIds) {
      results.push(await optimizeProductById(admin, productId));
    }

    const succeeded = results.filter((result) => result.ok).length;
    const failed = results.length - succeeded;
    const firstError = results.find((result) => !result.ok);

    return {
      ok: succeeded > 0,
      intent: "bulk" as const,
      succeeded,
      failed,
      total: results.length,
      error:
        failed > 0 && firstError && !firstError.ok
          ? firstError.error
          : undefined,
      results,
    };
  }

  const productId = String(formData.get("productId") || "");
  if (!productId) {
    return { ok: false as const, error: "Missing product id" };
  }

  const result = await optimizeProductById(admin, productId);
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }

  return {
    ok: true as const,
    intent: "single" as const,
    productId: result.productId,
    generated: result.generated,
  };
};

export default function ProductsPage() {
  const {
    products,
    page,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    search,
    sort,
    aiConfigured,
    maxBulk,
  } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const revalidator = useRevalidator();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const lastToastKey = useRef<string | null>(null);

  const productIdsKey = products.map((product) => product.id).join("|");

  useEffect(() => {
    setSelectedIds([]);
  }, [productIdsKey]);

  const isBusy =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  const loadingProductId =
    isBusy && fetcher.formData?.get("intent") === "single"
      ? String(fetcher.formData.get("productId") || "")
      : "";

  const isBulkRunning = isBusy && fetcher.formData?.get("intent") === "bulk";

  const selectedOnPage = useMemo(
    () => products.filter((product) => selectedIds.includes(product.id)).length,
    [products, selectedIds],
  );

  const allVisibleSelected =
    products.length > 0 && selectedOnPage === Math.min(products.length, maxBulk);

  useEffect(() => {
    if (!fetcher.data || fetcher.state !== "idle") return;

    const toastKey = JSON.stringify(fetcher.data);
    if (lastToastKey.current === toastKey) return;
    lastToastKey.current = toastKey;

    if (fetcher.data.intent === "bulk") {
      const succeeded = fetcher.data.succeeded ?? 0;
      const failed = fetcher.data.failed ?? 0;
      const total = fetcher.data.total ?? 0;

      if (succeeded > 0) {
        const successLabel =
          succeeded === 1
            ? "Optimized 1 product with AI"
            : `Optimized ${succeeded} products with AI`;
        shopify.toast.show(
          failed > 0 ? `${successLabel}. ${failed} of ${total} failed.` : successLabel,
        );
        setSelectedIds([]);
        revalidator.revalidate();
      } else if (fetcher.data.error) {
        shopify.toast.show(fetcher.data.error, { isError: true });
      }
      return;
    }

    if (fetcher.data.intent === "single" && fetcher.data.ok) {
      const title = fetcher.data.generated?.title;
      shopify.toast.show(
        title ? `Optimized: ${title}` : "1 product optimized with AI",
      );
      revalidator.revalidate();
      return;
    }

    if (fetcher.data.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, fetcher.state, shopify, revalidator]);

  const toggleSelected = (productId: string) => {
    setSelectedIds((current) => {
      if (current.includes(productId)) {
        return current.filter((id) => id !== productId);
      }
      if (current.length >= maxBulk) {
        shopify.toast.show(`You can optimize max ${maxBulk} products at once`, {
          isError: true,
        });
        return current;
      }
      return [...current, productId];
    });
  };

  const toggleSelectVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !products.some((product) => product.id === id)),
      );
      return;
    }

    setSelectedIds((current) => {
      const next = [...current];
      for (const product of products) {
        if (next.includes(product.id)) continue;
        if (next.length >= maxBulk) {
          shopify.toast.show(`You can optimize max ${maxBulk} products at once`, {
            isError: true,
          });
          break;
        }
        next.push(product.id);
      }
      return next;
    });
  };

  const generateOne = (productId: string) => {
    const formData = new FormData();
    formData.set("intent", "single");
    formData.set("productId", productId);
    fetcher.submit(formData, { method: "post" });
  };

  const generateBulk = () => {
    if (selectedIds.length === 0) {
      shopify.toast.show("Select at least one product", { isError: true });
      return;
    }

    const formData = new FormData();
    formData.set("intent", "bulk");
    for (const id of selectedIds.slice(0, maxBulk)) {
      formData.append("productIds", id);
    }
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <>
      <div className="dashboard-topbar">
        <div>
          <h1>Products</h1>
          <p>Generate titles, descriptions, and SEO meta — one by one or in bulk</p>
        </div>
      </div>

      {!aiConfigured && (
        <div className="dashboard-warning">
          Add <code>GEMINI_API_KEY</code> to <code>shopify-app/.env</code> for full AI
          generation.
        </div>
      )}

      <div className="dashboard-products-toolbar">
        <ProductsSearch defaultQuery={search} sort={sort} />
        <ProductsSort sort={sort} search={search} />
      </div>

      {products.length > 0 && (
        <div className="dashboard-bulk-bar">
          <label className="dashboard-bulk-select">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectVisible}
              disabled={isBusy}
            />
            <span>
              {selectedIds.length > 0
                ? `${selectedIds.length} selected (max ${maxBulk})`
                : `Select products (max ${maxBulk})`}
            </span>
          </label>
          <button
            type="button"
            className="dashboard-btn dashboard-btn-primary"
            disabled={isBusy || selectedIds.length === 0}
            onClick={generateBulk}
          >
            {isBulkRunning
              ? `Optimizing ${selectedIds.length}...`
              : `Bulk optimize (${selectedIds.length || 0})`}
          </button>
        </div>
      )}

      <div className="dashboard-products">
        {products.length === 0 ? (
          <div className="dashboard-card">
            {search
              ? `No products found for "${search}". Try a different search term.`
              : "No products yet. Create a product in Shopify Admin, then refresh."}
          </div>
        ) : (
          products.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              selected={selectedIds.includes(product.id)}
              onToggleSelected={toggleSelected}
              selectionDisabled={selectedIds.length >= maxBulk}
              isBusy={isBusy}
              thisLoading={loadingProductId === product.id}
              onGenerate={generateOne}
              shopify={shopify}
            />
          ))
        )}
      </div>

      <ProductsPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        hasPreviousPage={hasPreviousPage}
        hasNextPage={hasNextPage}
        search={search}
        sort={sort}
      />

      {fetcher.data?.ok && fetcher.data.intent === "single" && fetcher.data.generated && (
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
