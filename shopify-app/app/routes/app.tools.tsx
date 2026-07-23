import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, Link, useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcherActionFeedback } from "../hooks/useFetcherActionFeedback";
import { useReportClientError } from "../hooks/useReportClientError";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  TOOL_LANGUAGES,
  TOOL_TONES,
  buildProductSchema,
  generateMetaDescription,
  generateSeoTitles,
  optimizeProductImage,
  translateProductContent,
  type ImageOptimizeResult,
} from "../lib/ai-tools.server";
import {
  compressProductImage,
  fetchImageBuffer,
} from "../lib/image-compress.server";
import { replaceProductFeaturedImage } from "../lib/shopify-media.server";
import { isGeminiConfigured } from "../lib/gemini.server";
import {
  canUseAi,
  recordAiUsageIfFree,
  requireAiAccess,
} from "../lib/billing.server";
import { AiQuotaBanner } from "../components/AiQuotaBanner";
import { merchantAiError } from "../lib/merchant-errors";

type ToolProduct = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  status: string;
  onlineStoreUrl: string | null;
  featuredImage: { url: string; altText: string | null; id?: string } | null;
  featuredMediaId: string | null;
  seo: { title: string | null; description: string | null };
  price: string | null;
  sku: string | null;
  vendor: string | null;
};

type ToolTab = "translate" | "titles" | "alt" | "schema";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const search = (url.searchParams.get("q") || "").trim();
  const query = search.length > 0 ? search : null;

  const response = await admin.graphql(
    `#graphql
      query ToolsProductList($query: String) {
        products(first: 50, query: $query, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              title
              handle
              descriptionHtml
              status
              onlineStoreUrl
              vendor
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
              seo {
                title
                description
              }
              variants(first: 1) {
                edges {
                  node {
                    sku
                    price
                  }
                }
              }
            }
          }
        }
      }`,
    { variables: { query } },
  );

  const json = await response.json();
  const products: ToolProduct[] =
    json.data?.products?.edges?.map(
      (edge: {
        node: {
          id: string;
          title: string;
          handle: string;
          descriptionHtml: string;
          status: string;
          onlineStoreUrl: string | null;
          vendor: string | null;
          featuredMedia?: {
            id: string;
            preview?: { image?: { url: string; altText: string | null } };
          } | null;
          featuredImage?: {
            id?: string;
            url: string;
            altText: string | null;
          } | null;
          seo: { title: string | null; description: string | null };
          variants?: {
            edges: Array<{ node: { sku: string | null; price: string } }>;
          };
        };
      }) => {
        const variant = edge.node.variants?.edges?.[0]?.node;
        const image =
          edge.node.featuredImage ||
          (edge.node.featuredMedia?.preview?.image
            ? {
                url: edge.node.featuredMedia.preview.image.url,
                altText: edge.node.featuredMedia.preview.image.altText,
                id: edge.node.featuredMedia.id,
              }
            : null);

        return {
          id: edge.node.id,
          title: edge.node.title,
          handle: edge.node.handle,
          descriptionHtml: edge.node.descriptionHtml,
          status: edge.node.status,
          onlineStoreUrl: edge.node.onlineStoreUrl,
          featuredImage: image,
          featuredMediaId: edge.node.featuredMedia?.id || null,
          seo: edge.node.seo,
          price: variant?.price ?? null,
          sku: variant?.sku ?? null,
          vendor: edge.node.vendor,
        };
      },
    ) ?? [];

  return {
    products,
    search,
    shop: session.shop,
    aiConfigured: isGeminiConfigured(),
    languages: TOOL_LANGUAGES,
    tones: TOOL_TONES,
    billing: await canUseAi(session.shop),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const productId = String(formData.get("productId") || "");
  const shop = session.shop;

  if (!productId) {
    return { ok: false as const, error: "Select a product first" };
  }

  const productResponse = await admin.graphql(
    `#graphql
      query OneToolProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          descriptionHtml
          onlineStoreUrl
          vendor
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
          seo {
            title
            description
          }
          variants(first: 1) {
            edges {
              node {
                sku
                price
              }
            }
          }
        }
      }`,
    { variables: { id: productId } },
  );

  const productJson = await productResponse.json();
  const product = productJson.data?.product;
  if (!product) {
    return { ok: false as const, error: "Product not found" };
  }

  const variant = product.variants?.edges?.[0]?.node;
  const imageUrl =
    product.featuredImage?.url ||
    product.featuredMedia?.preview?.image?.url ||
    null;
  const mediaId = product.featuredMedia?.id || null;

  try {
    if (intent === "translate") {
      const apply = String(formData.get("apply") || "") === "1";
      let translated = {
        title: String(formData.get("title") || ""),
        descriptionHtml: String(formData.get("descriptionHtml") || ""),
        metaTitle: String(formData.get("metaTitle") || ""),
        metaDescription: String(formData.get("metaDescription") || ""),
      };

      if (!apply) {
        const access = await requireAiAccess(shop);
        if (!access.allowed) return access.deny;

        const sourceLanguage = String(formData.get("sourceLanguage") || "en");
        const targetLanguage = String(formData.get("targetLanguage") || "mk");
        if (sourceLanguage === targetLanguage) {
          return {
            ok: false as const,
            error: "Source and target language must be different",
          };
        }

        translated = await translateProductContent({
          sourceLanguage,
          targetLanguage,
          fields: {
            title: product.title,
            descriptionHtml: product.descriptionHtml || "",
            metaTitle: product.seo?.title || product.title,
            metaDescription: product.seo?.description || "",
          },
        });
        await recordAiUsageIfFree(shop);
      }

      if (apply) {
        if (!translated.title) {
          return { ok: false as const, error: "Generate a translation first" };
        }
        const updateResponse = await admin.graphql(
          `#graphql
            mutation ApplyTranslation($product: ProductUpdateInput!) {
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
        if (errors.length) {
          return {
            ok: false as const,
            error: errors.map((e: { message: string }) => e.message).join(", "),
          };
        }
      }

      return {
        ok: true as const,
        intent,
        applied: apply,
        result: translated,
      };
    }

    if (intent === "titles") {
      const apply = String(formData.get("apply") || "") === "1";
      const selectedTitle = String(formData.get("selectedTitle") || "");
      const metaFromForm = String(formData.get("metaDescription") || "");

      let titles: string[] = [];
      let metaDescription = metaFromForm;

      if (!apply) {
        const access = await requireAiAccess(shop);
        if (!access.allowed) return access.deny;

        const tone = String(formData.get("tone") || "professional");
        const language = String(formData.get("language") || "en");
        const country = String(formData.get("country") || "US");
        titles = await generateSeoTitles({
          productName: product.title,
          tone,
          language,
          country,
        });
        metaDescription = await generateMetaDescription({
          productName: product.title,
          tone,
          language,
          country,
          descriptionHtml: product.descriptionHtml || "",
        });
        await recordAiUsageIfFree(shop);
      } else {
        const titlesRaw = String(formData.get("titlesJson") || "[]");
        try {
          titles = JSON.parse(titlesRaw) as string[];
        } catch {
          titles = [];
        }
      }

      if (apply) {
        if (!selectedTitle || !metaDescription) {
          return {
            ok: false as const,
            error: "Select a title and generate meta first",
          };
        }
        const updateResponse = await admin.graphql(
          `#graphql
            mutation ApplyTitleMeta($product: ProductUpdateInput!) {
              productUpdate(product: $product) {
                product { id }
                userErrors { message }
              }
            }`,
          {
            variables: {
              product: {
                id: productId,
                title: selectedTitle,
                seo: {
                  title: selectedTitle.slice(0, 60),
                  description: metaDescription,
                },
              },
            },
          },
        );
        const updateJson = await updateResponse.json();
        const errors = updateJson.data?.productUpdate?.userErrors || [];
        if (errors.length) {
          return {
            ok: false as const,
            error: errors.map((e: { message: string }) => e.message).join(", "),
          };
        }
      }

      return {
        ok: true as const,
        intent,
        applied: apply,
        result: { titles, metaDescription },
      };
    }

    if (intent === "alt") {
      const apply = String(formData.get("apply") || "") === "1";

      if (!imageUrl) {
        return {
          ok: false as const,
          error: "This product has no featured image to optimize",
        };
      }

      if (!apply) {
        const access = await requireAiAccess(shop);
        if (!access.allowed) return access.deny;

        const altResult = await optimizeProductImage({
          productName: product.title,
          imageUrl,
          currentAlt: product.featuredImage?.altText || null,
          includePreview: true,
        });
        await recordAiUsageIfFree(shop);
        return {
          ok: true as const,
          intent,
          applied: false,
          result: altResult,
        };
      }

      const altText = String(formData.get("altText") || "").trim();
      const filenameSuggestion =
        String(formData.get("filenameSuggestion") || "").trim() ||
        "product.jpg";

      if (!altText) {
        return { ok: false as const, error: "Optimize the image first" };
      }

      const source = await fetchImageBuffer(imageUrl);
      if (!source) {
        return {
          ok: false as const,
          error: "Could not download the current product image",
        };
      }

      const compressed = await compressProductImage(source.bytes);
      await replaceProductFeaturedImage({
        admin,
        productId,
        oldMediaId: mediaId,
        imageBytes: compressed.bytes,
        filename: filenameSuggestion,
        mimeType: compressed.mimeType,
        altText,
      });

      const altResult: ImageOptimizeResult = {
        altText,
        filenameSuggestion,
        fileSizeKb: compressed.originalSizeKb,
        optimizedSizeKb: compressed.sizeKb,
        savingsPercent: compressed.savingsPercent,
        mimeType: source.mimeType,
        optimizedMime: compressed.mimeType,
        sizeRating: "good",
        dimensions: compressed.originalDimensions,
        optimizedDimensions: compressed.dimensions,
        wasResized: compressed.wasResized,
        previewDataUrl: null,
        currentAlt: product.featuredImage?.altText || null,
        canApply: false,
      };

      return {
        ok: true as const,
        intent,
        applied: true,
        result: altResult,
      };
    }

    if (intent === "schema") {
      const shopDomain = String(formData.get("shop") || "");
      const productUrl =
        product.onlineStoreUrl ||
        (shopDomain
          ? `https://${shopDomain}/products/${product.handle}`
          : undefined);

      const schema = buildProductSchema({
        productName: product.title,
        description: product.descriptionHtml || "",
        productUrl,
        imageUrl: imageUrl || undefined,
        sku: variant?.sku || undefined,
        brand: product.vendor || undefined,
        price: variant?.price || undefined,
        currency: "USD",
      });

      return {
        ok: true as const,
        intent,
        applied: false,
        result: schema,
      };
    }

    return { ok: false as const, error: "Unknown action" };
  } catch (error) {
    const { logAppError } = await import("../lib/error-log.server");
    const message = merchantAiError(error);
    await logAppError({
      shop,
      source: "tools.action",
      message,
      detail: error instanceof Error ? error.stack || error.message : String(error),
      path: `/app/tools#${intent}`,
    });
    return {
      ok: false as const,
      error: message,
    };
  }
};

export default function ToolsPage() {
  const { products, search, shop, aiConfigured, languages, tones, billing } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const reportClientError = useReportClientError();

  const [tab, setTab] = useState<ToolTab>("translate");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("mk");
  const [tone, setTone] = useState("professional");
  const [language, setLanguage] = useState("en");
  const [country, setCountry] = useState("US");
  const [selectedTitle, setSelectedTitle] = useState("");
  const lastToastKey = useRef<string | null>(null);

  useFetcherActionFeedback({
    fetcher,
    shopify,
    reportError: reportClientError,
  });

  const productIdsKey = products.map((product) => product.id).join("|");

  useEffect(() => {
    if (products.length === 0) {
      setProductId("");
      return;
    }
    if (!products.some((product) => product.id === productId)) {
      setProductId(products[0].id);
    }
  }, [productIdsKey, products, productId]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) || null,
    [products, productId],
  );

  const isBusy =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (!fetcher.data || fetcher.state !== "idle") return;
    const toastKey = JSON.stringify(fetcher.data);
    if (lastToastKey.current === toastKey) return;
    lastToastKey.current = toastKey;

    if (fetcher.data.ok) {
      if (fetcher.data.applied) {
        shopify.toast.show(
          fetcher.data.intent === "alt"
            ? "Optimized image saved to Shopify"
            : "Saved to Shopify product",
        );
      } else if (fetcher.data.intent === "schema") {
        shopify.toast.show("Schema generated");
      } else if (fetcher.data.intent === "alt") {
        shopify.toast.show("Image optimized — review and apply");
      } else {
        shopify.toast.show("Generated successfully");
      }
    } else if (fetcher.data.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, fetcher.state, shopify]);

  useEffect(() => {
    setSelectedTitle("");
  }, [productId, tab]);

  const submitTool = (intent: ToolTab, apply = false) => {
    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("productId", productId);
    formData.set("shop", shop);
    formData.set("apply", apply ? "1" : "0");

    if (intent === "translate") {
      formData.set("sourceLanguage", sourceLanguage);
      formData.set("targetLanguage", targetLanguage);
      if (
        apply &&
        fetcher.data?.ok &&
        fetcher.data.intent === "translate" &&
        fetcher.data.result &&
        "title" in fetcher.data.result
      ) {
        formData.set("title", fetcher.data.result.title);
        formData.set("descriptionHtml", fetcher.data.result.descriptionHtml);
        formData.set("metaTitle", fetcher.data.result.metaTitle);
        formData.set("metaDescription", fetcher.data.result.metaDescription);
      }
    }
    if (intent === "titles") {
      formData.set("tone", tone);
      formData.set("language", language);
      formData.set("country", country);
      if (
        apply &&
        fetcher.data?.ok &&
        fetcher.data.intent === "titles" &&
        fetcher.data.result &&
        "titles" in fetcher.data.result
      ) {
        formData.set("selectedTitle", selectedTitle);
        formData.set("metaDescription", fetcher.data.result.metaDescription);
        formData.set("titlesJson", JSON.stringify(fetcher.data.result.titles));
      }
    }
    if (
      intent === "alt" &&
      apply &&
      fetcher.data?.ok &&
      fetcher.data.intent === "alt" &&
      fetcher.data.result &&
      "altText" in fetcher.data.result
    ) {
      const imageResult = fetcher.data.result as ImageOptimizeResult;
      formData.set("altText", imageResult.altText);
      formData.set("filenameSuggestion", imageResult.filenameSuggestion);
    }

    fetcher.submit(formData, { method: "post" });
  };

  const result = fetcher.data?.ok ? fetcher.data.result : null;

  return (
    <>
      <div className="dashboard-topbar">
        <div>
          <h1>Tools</h1>
          <p>Translator, titles & meta, image optimizer, and product schema</p>
        </div>
      </div>

      {!aiConfigured && (
        <div className="dashboard-warning">
          AI tools are temporarily unavailable. Schema markup still works — contact
          support if this continues.
        </div>
      )}
      <AiQuotaBanner billing={billing} />

      <Form
        method="get"
        action="/app/tools"
        className="dashboard-product-search dashboard-tools-search"
      >
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search products by title, SKU, or tag..."
          className="dashboard-search-input"
          aria-label="Search products"
        />
        <button type="submit" className="dashboard-btn dashboard-btn-primary">
          Search
        </button>
        {search ? (
          <Link to="/app/tools" className="dashboard-btn dashboard-btn-ghost">
            Clear
          </Link>
        ) : null}
      </Form>

      {products.length === 0 ? (
        <div className="dashboard-card">
          {search
            ? `No products found for "${search}". Try a different search term.`
            : "No products found. Import or create products in Shopify first."}
        </div>
      ) : (
        <>
          <div className="dashboard-tools-bar">
            <label className="dashboard-field">
              <span>
                Product
                {search ? ` (${products.length} matches)` : ""}
              </span>
              <select
                className="dashboard-sort-select"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                disabled={isBusy}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.title}
                  </option>
                ))}
              </select>
            </label>

            {selectedProduct?.featuredImage?.url ? (
              <img
                src={selectedProduct.featuredImage.url}
                alt={selectedProduct.featuredImage.altText || selectedProduct.title}
                className="dashboard-tools-preview-thumb"
              />
            ) : null}
          </div>

          <div className="dashboard-tabs">
            {(
              [
                ["translate", "Translator"],
                ["titles", "Titles & Meta"],
                ["alt", "Image Optimizer"],
                ["schema", "Schema"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`dashboard-tab${tab === id ? " is-active" : ""}`}
                onClick={() => setTab(id)}
                disabled={isBusy}
              >
                {label}
              </button>
            ))}
          </div>

          <section className="dashboard-card">
            {tab === "translate" && (
              <>
                <h2>Translator</h2>
                <p className="dashboard-tools-help">
                  Translate title, description, and SEO meta into another language.
                </p>
                <div className="dashboard-tools-grid">
                  <label className="dashboard-field">
                    <span>From</span>
                    <select
                      className="dashboard-sort-select"
                      value={sourceLanguage}
                      onChange={(e) => setSourceLanguage(e.target.value)}
                    >
                      {languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="dashboard-field">
                    <span>To</span>
                    <select
                      className="dashboard-sort-select"
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                    >
                      {languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="dashboard-tools-actions">
                  <button
                    type="button"
                    className="dashboard-btn dashboard-btn-primary"
                    disabled={isBusy || !productId}
                    onClick={() => submitTool("translate", false)}
                  >
                    {isBusy ? "Working..." : "Translate"}
                  </button>
                  <button
                    type="button"
                    className="dashboard-btn dashboard-btn-ghost"
                    disabled={isBusy || !productId || !result || !(fetcher.data?.ok && fetcher.data.intent === "translate")}
                    onClick={() => submitTool("translate", true)}
                  >
                    Apply to product
                  </button>
                </div>
                {fetcher.data?.ok && fetcher.data.intent === "translate" && result && "title" in result && (
                  <div className="dashboard-tools-result">
                    <p><strong>Title:</strong> {result.title}</p>
                    <p><strong>Meta title:</strong> {result.metaTitle}</p>
                    <p><strong>Meta description:</strong> {result.metaDescription}</p>
                    <div
                      className="dashboard-tools-html"
                      dangerouslySetInnerHTML={{ __html: result.descriptionHtml }}
                    />
                  </div>
                )}
              </>
            )}

            {tab === "titles" && (
              <>
                <h2>Titles & Meta</h2>
                <p className="dashboard-tools-help">
                  Generate SEO titles and one meta description, then apply your pick.
                </p>
                <div className="dashboard-tools-grid">
                  <label className="dashboard-field">
                    <span>Tone</span>
                    <select
                      className="dashboard-sort-select"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                    >
                      {tones.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="dashboard-field">
                    <span>Language</span>
                    <select
                      className="dashboard-sort-select"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      {languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="dashboard-field">
                    <span>Country</span>
                    <select
                      className="dashboard-sort-select"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    >
                      {["US", "UK", "DE", "FR", "MK", "RS", "HR", "BG", "GR", "TR"].map(
                        (code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>
                <div className="dashboard-tools-actions">
                  <button
                    type="button"
                    className="dashboard-btn dashboard-btn-primary"
                    disabled={isBusy || !productId}
                    onClick={() => submitTool("titles", false)}
                  >
                    {isBusy ? "Working..." : "Generate"}
                  </button>
                  <button
                    type="button"
                    className="dashboard-btn dashboard-btn-ghost"
                    disabled={
                      isBusy ||
                      !selectedTitle ||
                      !(fetcher.data?.ok && fetcher.data.intent === "titles")
                    }
                    onClick={() => submitTool("titles", true)}
                  >
                    Apply selected title + meta
                  </button>
                </div>
                {fetcher.data?.ok &&
                  fetcher.data.intent === "titles" &&
                  result &&
                  "titles" in result && (
                    <div className="dashboard-tools-result">
                      <p>
                        <strong>Meta description:</strong> {result.metaDescription}
                      </p>
                      <div className="dashboard-title-list">
                        {result.titles.map((title) => (
                          <label key={title} className="dashboard-title-option">
                            <input
                              type="radio"
                              name="selectedTitle"
                              checked={selectedTitle === title}
                              onChange={() => setSelectedTitle(title)}
                            />
                            <span>{title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}

            {tab === "alt" && (
              <>
                <h2>Image Optimizer</h2>
                <p className="dashboard-tools-help">
                  Compress and resize the featured image (max 1200px, JPEG
                  quality 82), then confirm before replacing it in Shopify.
                </p>
                {!selectedProduct?.featuredImage?.url ? (
                  <p className="dashboard-tools-help">
                    This product has no featured image yet.
                  </p>
                ) : null}
                <div className="dashboard-tools-actions">
                  <button
                    type="button"
                    className="dashboard-btn dashboard-btn-primary"
                    disabled={
                      isBusy || !productId || !selectedProduct?.featuredImage?.url
                    }
                    onClick={() => submitTool("alt", false)}
                  >
                    {isBusy ? "Working..." : "Optimize image"}
                  </button>
                  <button
                    type="button"
                    className="dashboard-btn dashboard-btn-ghost"
                    disabled={
                      isBusy ||
                      !productId ||
                      !(fetcher.data?.ok && fetcher.data.intent === "alt") ||
                      !result ||
                      !("canApply" in result) ||
                      !result.canApply
                    }
                    onClick={() => {
                      if (
                        !result ||
                        !("optimizedSizeKb" in result) ||
                        !result.canApply
                      ) {
                        return;
                      }
                      const from = result.fileSizeKb ?? "?";
                      const to = result.optimizedSizeKb ?? "?";
                      const savings =
                        result.savingsPercent != null
                          ? ` (${result.savingsPercent}% smaller)`
                          : "";
                      const confirmed = window.confirm(
                        `Replace the product image in Shopify with the optimized version?\n\n${from} KB → ${to} KB${savings}\n\nThis will upload a new image and remove the current featured image.`,
                      );
                      if (!confirmed) return;
                      submitTool("alt", true);
                    }}
                  >
                    Apply to Shopify
                  </button>
                </div>
                {fetcher.data?.ok &&
                  fetcher.data.intent === "alt" &&
                  result &&
                  "altText" in result && (
                    <div className="dashboard-tools-result">
                      <div className="dashboard-image-compare">
                        {selectedProduct?.featuredImage?.url ? (
                          <div>
                            <span className="dashboard-image-stats-label">
                              Current
                            </span>
                            <img
                              src={selectedProduct.featuredImage.url}
                              alt={
                                selectedProduct.featuredImage.altText ||
                                selectedProduct.title
                              }
                              className="dashboard-image-compare-thumb"
                            />
                          </div>
                        ) : null}
                        {"previewDataUrl" in result && result.previewDataUrl ? (
                          <div>
                            <span className="dashboard-image-stats-label">
                              Optimized preview
                            </span>
                            <img
                              src={result.previewDataUrl}
                              alt={result.altText}
                              className="dashboard-image-compare-thumb"
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="dashboard-image-stats">
                        <div>
                          <span className="dashboard-image-stats-label">
                            Original
                          </span>
                          <strong>
                            {result.fileSizeKb != null
                              ? `${result.fileSizeKb} KB`
                              : "—"}
                            {result.dimensions ? ` · ${result.dimensions}` : ""}
                          </strong>
                        </div>
                        <div>
                          <span className="dashboard-image-stats-label">
                            Optimized
                          </span>
                          <strong>
                            {"optimizedSizeKb" in result &&
                            result.optimizedSizeKb != null
                              ? `${result.optimizedSizeKb} KB`
                              : "—"}
                            {"optimizedDimensions" in result &&
                            result.optimizedDimensions
                              ? ` · ${result.optimizedDimensions}`
                              : ""}
                          </strong>
                        </div>
                        <div>
                          <span className="dashboard-image-stats-label">
                            Savings
                          </span>
                          <strong>
                            {"savingsPercent" in result &&
                            result.savingsPercent != null
                              ? `${result.savingsPercent}%`
                              : "—"}
                            {"wasResized" in result && result.wasResized
                              ? " · resized"
                              : ""}
                          </strong>
                        </div>
                        <div>
                          <span className="dashboard-image-stats-label">
                            Format
                          </span>
                          <strong>
                            {"optimizedMime" in result && result.optimizedMime
                              ? result.optimizedMime.replace("image/", "")
                              : "jpeg"}
                          </strong>
                        </div>
                      </div>
                      <p>
                        <strong>Alt text:</strong> {result.altText}
                      </p>
                      <p>
                        <strong>Filename:</strong> {result.filenameSuggestion}
                      </p>
                      {fetcher.data.applied ? (
                        <p className="dashboard-tools-help">
                          Optimized image is now live on the product.
                        </p>
                      ) : (
                        <p className="dashboard-tools-help">
                          Review the preview, then click Apply to Shopify — you
                          will be asked to confirm first.
                        </p>
                      )}
                    </div>
                  )}
              </>
            )}

            {tab === "schema" && (
              <>
                <h2>Product Schema (JSON-LD)</h2>
                <p className="dashboard-tools-help">
                  Generate Product structured data you can paste into your theme.
                </p>
                <div className="dashboard-tools-actions">
                  <button
                    type="button"
                    className="dashboard-btn dashboard-btn-primary"
                    disabled={isBusy || !productId}
                    onClick={() => submitTool("schema", false)}
                  >
                    {isBusy ? "Working..." : "Generate schema"}
                  </button>
                  {fetcher.data?.ok &&
                    fetcher.data.intent === "schema" &&
                    result &&
                    "jsonLd" in result && (
                      <button
                        type="button"
                        className="dashboard-btn dashboard-btn-ghost"
                        onClick={async () => {
                          await navigator.clipboard.writeText(result.jsonLd);
                          shopify.toast.show("JSON-LD copied");
                        }}
                      >
                        Copy JSON-LD
                      </button>
                    )}
                </div>
                {fetcher.data?.ok &&
                  fetcher.data.intent === "schema" &&
                  result &&
                  "jsonLd" in result && (
                    <pre className="dashboard-schema-code">{result.jsonLd}</pre>
                  )}
              </>
            )}
          </section>
        </>
      )}
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
