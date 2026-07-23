import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, Link, useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect, useRef, useState } from "react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  applyCollectionGenerated,
  fetchCollections,
  optimizeCollectionById,
} from "../lib/collections.server";
import { BulkProgressBar } from "../components/BulkProgressBar";
import { useSequentialBulk } from "../hooks/useSequentialBulk";
import { useFetcherActionFeedback } from "../hooks/useFetcherActionFeedback";
import { useReportClientError } from "../hooks/useReportClientError";
import { AiQuotaBanner } from "../components/AiQuotaBanner";
import { UpgradeToProButton } from "../components/UpgradeToProButton";
import { canUseAi, requireProPlan } from "../lib/billing.server";
import { isGeminiConfigured } from "../lib/gemini.server";

export const MAX_BULK_COLLECTIONS = 20;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const search = (url.searchParams.get("q") || "").trim();
  const collections = await fetchCollections(admin, search);

  return {
    collections,
    search,
    aiConfigured: isGeminiConfigured(),
    maxBulk: MAX_BULK_COLLECTIONS,
    billing: await canUseAi(session.shop),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "single");
  const shop = session.shop;

  try {
  if (intent === "bulk") {
    const pro = await requireProPlan(shop);
    if (!pro.allowed) return pro.deny;

    const collectionIds = formData
      .getAll("collectionIds")
      .map((value) => String(value))
      .filter(Boolean)
      .slice(0, MAX_BULK_COLLECTIONS);

    if (collectionIds.length === 0) {
      return { ok: false as const, error: "Select at least one collection" };
    }

    const results = [];
    for (const collectionId of collectionIds) {
      results.push(
        await optimizeCollectionById(admin, collectionId, shop, { apply: true }),
      );
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
    };
  }

  const collectionId = String(formData.get("collectionId") || "");
  if (!collectionId) {
    return { ok: false as const, error: "Missing collection id" };
  }

  if (intent === "apply") {
    const generated = {
      title: String(formData.get("title") || ""),
      descriptionHtml: String(formData.get("descriptionHtml") || ""),
      metaTitle: String(formData.get("metaTitle") || ""),
      metaDescription: String(formData.get("metaDescription") || ""),
    };
    if (!generated.title.trim()) {
      return { ok: false as const, error: "Nothing to apply — generate first" };
    }
    const result = await applyCollectionGenerated(
      admin,
      collectionId,
      generated,
      shop,
    );
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
    return {
      ok: true as const,
      intent: "apply" as const,
      title: result.title,
      applied: true as const,
      generated: result.generated,
    };
  }

  const result = await optimizeCollectionById(admin, collectionId, shop, {
    apply: false,
  });
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }

  return {
    ok: true as const,
    intent: "single" as const,
    title: result.title,
    applied: false as const,
    collectionId: result.collectionId,
    generated: result.generated,
  };
  } catch (error) {
    const { logAppError } = await import("../lib/error-log.server");
    const { merchantAiError } = await import("../lib/merchant-errors");
    const message = merchantAiError(error);
    await logAppError({
      shop,
      source: "collections.action",
      message,
      detail: error instanceof Error ? error.stack || error.message : String(error),
      path: `/app/collections#${intent}`,
    });
    return { ok: false as const, error: message, intent: intent as "single" };
  }
};

export default function CollectionsPage() {
  const { collections, search, aiConfigured, maxBulk, billing } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const revalidator = useRevalidator();
  const reportClientError = useReportClientError();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const lastToastKey = useRef<string | null>(null);

  const { progress: bulkProgress, startBulk, isBulkRunning } = useSequentialBulk({
    fetcher,
    bulkIntents: ["bulk"],
    onComplete: ({ succeeded, failed, total }) => {
      if (succeeded > 0) {
        shopify.toast.show(
          failed > 0
            ? `Optimized ${succeeded}/${total} collections, ${failed} failed`
            : succeeded === 1
              ? "Optimized 1 collection"
              : `Optimized ${succeeded} collections`,
        );
        setSelectedIds([]);
        revalidator.revalidate();
      } else {
        shopify.toast.show("Collection bulk optimize failed", { isError: true });
      }
    },
  });

  useFetcherActionFeedback({
    fetcher,
    shopify,
    disabled: isBulkRunning,
    reportError: reportClientError,
  });

  const isBusy =
    isBulkRunning ||
    (["loading", "submitting"].includes(fetcher.state) &&
      fetcher.formMethod === "POST");
  const loadingId =
    !isBulkRunning &&
    isBusy &&
    fetcher.formData?.get("intent") === "single"
      ? String(fetcher.formData.get("collectionId") || "")
      : "";

  const collectionIdsKey = collections.map((item) => item.id).join("|");

  useEffect(() => {
    setSelectedIds([]);
  }, [search, collectionIdsKey]);

  useEffect(() => {
    if (isBulkRunning) return;
    if (!fetcher.data || fetcher.state !== "idle") return;
    const toastKey = JSON.stringify(fetcher.data);
    if (lastToastKey.current === toastKey) return;
    lastToastKey.current = toastKey;

    if (fetcher.data.ok && fetcher.data.intent === "bulk") {
      return;
    }

    if (fetcher.data.ok) {
      if (fetcher.data.intent === "apply") {
        shopify.toast.show(
          fetcher.data.title
            ? `Applied: ${fetcher.data.title}`
            : "Applied to collection",
        );
        revalidator.revalidate();
      } else if (fetcher.data.intent === "single") {
        shopify.toast.show("Draft ready — review and apply");
      }
    } else if (fetcher.data.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, fetcher.state, shopify, revalidator, isBulkRunning]);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= maxBulk) {
        shopify.toast.show(`Max ${maxBulk} collections at once`, {
          isError: true,
        });
        return current;
      }
      return [...current, id];
    });
  };

  const runOne = (collectionId: string) => {
    const formData = new FormData();
    formData.set("intent", "single");
    formData.set("collectionId", collectionId);
    fetcher.submit(formData, { method: "post" });
  };

  const applyDraft = () => {
    if (
      !fetcher.data?.ok ||
      fetcher.data.intent !== "single" ||
      !fetcher.data.generated ||
      !("collectionId" in fetcher.data)
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("intent", "apply");
    formData.set("collectionId", String(fetcher.data.collectionId));
    formData.set("title", fetcher.data.generated.title);
    formData.set("descriptionHtml", fetcher.data.generated.descriptionHtml);
    formData.set("metaTitle", fetcher.data.generated.metaTitle);
    formData.set("metaDescription", fetcher.data.generated.metaDescription);
    fetcher.submit(formData, { method: "post" });
  };

  const runBulk = () => {
    if (billing.plan !== "pro") {
      shopify.toast.show("Bulk actions require Pro — open Settings to upgrade", {
        isError: true,
      });
      return;
    }
    if (selectedIds.length === 0) {
      shopify.toast.show("Select at least one collection", { isError: true });
      return;
    }
    startBulk({
      ids: selectedIds.slice(0, maxBulk),
      label: "Bulk optimize",
      buildFormData: (collectionId) => {
        const formData = new FormData();
        formData.set("intent", "bulk");
        formData.append("collectionIds", collectionId);
        return formData;
      },
    });
  };

  return (
    <>
      <div className="dashboard-topbar">
        <div>
          <h1>Collections</h1>
          <p>Optimize collection titles, descriptions, and SEO meta</p>
        </div>
      </div>

      {!aiConfigured && (
        <div className="dashboard-warning">
          AI generation is temporarily unavailable for collections. Contact support
          if this continues.
        </div>
      )}
      <AiQuotaBanner billing={billing} />

      <Form
        method="get"
        action="/app/collections"
        className="dashboard-product-search dashboard-tools-search"
      >
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search collections..."
          className="dashboard-search-input"
          aria-label="Search collections"
        />
        <button type="submit" className="dashboard-btn dashboard-btn-primary">
          Search
        </button>
        {search ? (
          <Link to="/app/collections" className="dashboard-btn dashboard-btn-ghost">
            Clear
          </Link>
        ) : null}
      </Form>

      {collections.length > 0 && (
        <div className="dashboard-bulk-bar">
          <label className="dashboard-bulk-select">
            <input
              type="checkbox"
              checked={
                collections.length > 0 &&
                selectedIds.length === Math.min(collections.length, maxBulk)
              }
              disabled={isBusy}
              onChange={() => {
                if (selectedIds.length === Math.min(collections.length, maxBulk)) {
                  setSelectedIds([]);
                  return;
                }
                setSelectedIds(
                  collections.slice(0, maxBulk).map((item) => item.id),
                );
              }}
            />
            <span>
              {selectedIds.length > 0
                ? `${selectedIds.length} selected (max ${maxBulk})`
                : `Select collections (max ${maxBulk})`}
            </span>
          </label>
          <div className="dashboard-bulk-controls">
            <span className="dashboard-badge dashboard-badge-pro">Pro</span>
            {billing.plan === "pro" ? (
              <button
                type="button"
                className="dashboard-btn dashboard-btn-primary"
                disabled={isBusy || selectedIds.length === 0}
                onClick={runBulk}
              >
                {isBulkRunning
                  ? `${bulkProgress?.percent ?? 0}%`
                  : `Bulk optimize (${selectedIds.length || 0})`}
              </button>
            ) : (
              <UpgradeToProButton className="dashboard-btn dashboard-btn-primary" />
            )}
          </div>
        </div>
      )}

      {bulkProgress && <BulkProgressBar {...bulkProgress} />}

      <div className="dashboard-products">
        {collections.length === 0 ? (
          <div className="dashboard-card">
            {search
              ? `No collections found for "${search}".`
              : "No collections yet. Create a collection in Shopify Admin."}
          </div>
        ) : (
          collections.map((collection) => (
            <div
              key={collection.id}
              className={`dashboard-product-row${
                selectedIds.includes(collection.id) ? " is-selected" : ""
              }`}
            >
              <div className="dashboard-product-main">
                <label className="dashboard-product-check">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(collection.id)}
                    disabled={
                      isBusy ||
                      (selectedIds.length >= maxBulk &&
                        !selectedIds.includes(collection.id))
                    }
                    onChange={() => toggleSelected(collection.id)}
                  />
                </label>
                <div className="dashboard-product-thumb">
                  {collection.image?.url ? (
                    <img
                      src={collection.image.url}
                      alt={collection.image.altText || collection.title}
                    />
                  ) : (
                    <div className="dashboard-product-thumb-placeholder">
                      No image
                    </div>
                  )}
                </div>
                <div className="dashboard-product-copy">
                  <strong>{collection.title}</strong>
                  <div className="dashboard-product-meta">
                    /{collection.handle}
                    {collection.seo?.title
                      ? ` · ${collection.seo.title}`
                      : " · No meta title"}
                  </div>
                </div>
              </div>
              <div className="dashboard-product-actions">
                <button
                  type="button"
                  className="dashboard-btn dashboard-btn-primary"
                  disabled={isBusy}
                  onClick={() => runOne(collection.id)}
                >
                  {loadingId === collection.id
                    ? "Optimizing..."
                    : "Optimize with AI"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {fetcher.data?.ok &&
        (fetcher.data.intent === "single" || fetcher.data.intent === "apply") &&
        fetcher.data.generated && (
          <section className="dashboard-card" style={{ marginTop: "1rem" }}>
            <h2>Last result</h2>
            <div className="dashboard-tools-result">
              <p style={{ margin: 0 }}>
                <strong>Title:</strong> {fetcher.data.generated.title}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Meta title:</strong> {fetcher.data.generated.metaTitle}
              </p>
              <div>
                <strong>Meta description:</strong>
                <p className="dashboard-result-text">
                  {fetcher.data.generated.metaDescription}
                </p>
              </div>
              <div>
                <strong>Description:</strong>
                <div
                  className="dashboard-tools-html"
                  dangerouslySetInnerHTML={{
                    __html: fetcher.data.generated.descriptionHtml,
                  }}
                />
              </div>
              {fetcher.data.intent === "single" && (
                <div className="dashboard-tools-actions" style={{ marginBottom: 0 }}>
                  <button
                    type="button"
                    className="dashboard-btn dashboard-btn-primary"
                    disabled={isBusy}
                    onClick={applyDraft}
                  >
                    {isBusy && fetcher.formData?.get("intent") === "apply"
                      ? "Applying..."
                      : "Apply to collection"}
                  </button>
                </div>
              )}
              {fetcher.data.intent === "apply" && (
                <p className="dashboard-settings-note" style={{ margin: 0 }}>
                  Saved to Shopify.
                </p>
              )}
            </div>
          </section>
        )}
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
