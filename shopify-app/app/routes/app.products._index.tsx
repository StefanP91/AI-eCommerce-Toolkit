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
import { parseProductFilter, parseProductSort } from "../lib/products";
import {
  altProductById,
  optimizeProductById,
  translateProductById,
} from "../lib/optimize-product.server";
import { TOOL_LANGUAGES } from "../lib/ai-tools.server";
import { ProductRow } from "../components/ProductRow";
import { ProductsPagination } from "../components/ProductsPagination";
import { ProductsSearch } from "../components/ProductsSearch";
import { ProductsSort } from "../components/ProductsSort";
import { ProductsFilter } from "../components/ProductsFilter";

export const MAX_BULK_OPTIMIZE = 20;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
  const search = (url.searchParams.get("q") || "").trim();
  const sort = parseProductSort(url.searchParams.get("sort"));
  const filter = parseProductFilter(url.searchParams.get("filter"));
  const productsPage = await fetchProductsPage(
    admin,
    page,
    search,
    sort,
    filter,
  );

  return {
    ...productsPage,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    maxBulk: MAX_BULK_OPTIMIZE,
    languages: TOOL_LANGUAGES,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "single");
  const shop = session.shop;

  if (intent === "bulk" || intent === "bulk_translate" || intent === "bulk_alt") {
    const productIds = formData
      .getAll("productIds")
      .map((value) => String(value))
      .filter(Boolean)
      .slice(0, MAX_BULK_OPTIMIZE);

    if (productIds.length === 0) {
      return { ok: false as const, error: "Select at least one product" };
    }

    const results = [];
    if (intent === "bulk_translate") {
      const sourceLanguage = String(formData.get("sourceLanguage") || "en");
      const targetLanguage = String(formData.get("targetLanguage") || "mk");
      if (sourceLanguage === targetLanguage) {
        return {
          ok: false as const,
          error: "Source and target language must be different",
        };
      }
      for (const productId of productIds) {
        results.push(
          await translateProductById(admin, productId, {
            sourceLanguage,
            targetLanguage,
            shop,
          }),
        );
      }
    } else if (intent === "bulk_alt") {
      for (const productId of productIds) {
        results.push(await altProductById(admin, productId, shop));
      }
    } else {
      for (const productId of productIds) {
        results.push(await optimizeProductById(admin, productId, shop));
      }
    }

    const succeeded = results.filter((result) => result.ok).length;
    const failed = results.length - succeeded;
    const firstError = results.find((result) => !result.ok);

    return {
      ok: succeeded > 0,
      intent,
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

  const result = await optimizeProductById(admin, productId, shop);
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
    filter,
    aiConfigured,
    maxBulk,
    languages,
  } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const revalidator = useRevalidator();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<
    "bulk" | "bulk_translate" | "bulk_alt"
  >("bulk");
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("mk");
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

  const isBulkRunning =
    isBusy &&
    ["bulk", "bulk_translate", "bulk_alt"].includes(
      String(fetcher.formData?.get("intent") || ""),
    );

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

    if (
      fetcher.data.intent === "bulk" ||
      fetcher.data.intent === "bulk_translate" ||
      fetcher.data.intent === "bulk_alt"
    ) {
      const succeeded = fetcher.data.succeeded ?? 0;
      const failed = fetcher.data.failed ?? 0;
      const total = fetcher.data.total ?? 0;
      const verb =
        fetcher.data.intent === "bulk_translate"
          ? "Translated"
          : fetcher.data.intent === "bulk_alt"
            ? "Updated alt for"
            : "Optimized";

      if (succeeded > 0) {
        const successLabel =
          succeeded === 1
            ? `${verb} 1 product`
            : `${verb} ${succeeded} products`;
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

  const runBulk = () => {
    if (selectedIds.length === 0) {
      shopify.toast.show("Select at least one product", { isError: true });
      return;
    }

    const formData = new FormData();
    formData.set("intent", bulkAction);
    if (bulkAction === "bulk_translate") {
      formData.set("sourceLanguage", sourceLanguage);
      formData.set("targetLanguage", targetLanguage);
    }
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
        <ProductsSearch defaultQuery={search} sort={sort} filter={filter} />
        <div className="dashboard-products-toolbar-right">
          <ProductsFilter filter={filter} search={search} sort={sort} />
          <ProductsSort sort={sort} search={search} filter={filter} />
        </div>
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

          <div className="dashboard-bulk-controls">
            <select
              className="dashboard-sort-select"
              value={bulkAction}
              disabled={isBusy}
              onChange={(event) =>
                setBulkAction(
                  event.target.value as "bulk" | "bulk_translate" | "bulk_alt",
                )
              }
              aria-label="Bulk action"
            >
              <option value="bulk">Bulk optimize</option>
              <option value="bulk_translate">Bulk translate</option>
              <option value="bulk_alt">Bulk alt text</option>
            </select>

            {bulkAction === "bulk_translate" && (
              <>
                <select
                  className="dashboard-sort-select"
                  value={sourceLanguage}
                  disabled={isBusy}
                  onChange={(event) => setSourceLanguage(event.target.value)}
                  aria-label="Source language"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      From {lang.label}
                    </option>
                  ))}
                </select>
                <select
                  className="dashboard-sort-select"
                  value={targetLanguage}
                  disabled={isBusy}
                  onChange={(event) => setTargetLanguage(event.target.value)}
                  aria-label="Target language"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      To {lang.label}
                    </option>
                  ))}
                </select>
              </>
            )}

            <button
              type="button"
              className="dashboard-btn dashboard-btn-primary"
              disabled={isBusy || selectedIds.length === 0}
              onClick={runBulk}
            >
              {isBulkRunning
                ? `Working on ${selectedIds.length}...`
                : `Run (${selectedIds.length || 0})`}
            </button>
          </div>
        </div>
      )}

      <div className="dashboard-products">
        {products.length === 0 ? (
          <div className="dashboard-card">
            {filter === "needs_ai"
              ? search
                ? `No products needing AI found for "${search}".`
                : "Nice — no products currently need AI optimization."
              : search
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
        filter={filter}
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
