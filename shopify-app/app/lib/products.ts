export type ProductNode = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  status: string;
  featuredImage: {
    url: string;
    altText: string | null;
  } | null;
  seo: {
    title: string | null;
    description: string | null;
  };
};

export type ProductSort = "updated" | "seo_desc" | "seo_asc";
export type ProductFilter = "all" | "needs_ai";

export const PRODUCT_SORT_OPTIONS: Array<{
  value: ProductSort;
  label: string;
}> = [
  { value: "updated", label: "Recently updated" },
  { value: "seo_desc", label: "SEO score: High to Low" },
  { value: "seo_asc", label: "SEO score: Low to High" },
];

export const NEEDS_AI_SCORE_THRESHOLD = 75;

export function parseProductSort(value: string | null): ProductSort {
  if (value === "seo_desc" || value === "seo_asc") {
    return value;
  }
  return "updated";
}

export function parseProductFilter(value: string | null): ProductFilter {
  return value === "needs_ai" ? "needs_ai" : "all";
}

export function buildProductsUrl(
  options: {
    page?: number;
    q?: string;
    sort?: ProductSort;
    filter?: ProductFilter;
  } = {},
) {
  const params = new URLSearchParams();
  const query = options.q?.trim();

  if (query) {
    params.set("q", query);
  }
  if (options.sort && options.sort !== "updated") {
    params.set("sort", options.sort);
  }
  if (options.filter && options.filter !== "all") {
    params.set("filter", options.filter);
  }
  if (options.page && options.page > 1) {
    params.set("page", String(options.page));
  }

  const search = params.toString();
  return search ? `/app/products?${search}` : "/app/products";
}

export type DashboardStats = {
  totalProducts: number;
  productsOptimized: number;
  timeSavedHours: string;
  avgSeoScore: number;
  ctrEstimate: number;
  seoBreakdown: {
    excellent: number;
    good: number;
    needsWork: number;
    poor: number;
  };
  recentActivity: Array<{
    id: string;
    title: string;
    type: string;
    status: "Optimized" | "Needs AI";
    seoScore: number;
  }>;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function scoreProduct(product: ProductNode): number {
  let score = 0;
  if (product.title?.trim()) score += 25;
  if (stripHtml(product.descriptionHtml).length >= 80) score += 25;
  if (product.seo?.title?.trim()) score += 25;
  if (product.seo?.description?.trim()) score += 25;
  return score;
}

export function getProductSeoTips(product: ProductNode): string[] {
  const tips: string[] = [];
  const descriptionLength = stripHtml(product.descriptionHtml || "").length;

  if (!product.title?.trim() || product.title.trim().length < 20) {
    tips.push("Title is missing or too short for SEO");
  }
  if (descriptionLength < 80) {
    tips.push("Description needs more detail (80+ characters)");
  }
  if (!product.seo?.title?.trim()) {
    tips.push("Add a meta title");
  }
  if (!product.seo?.description?.trim()) {
    tips.push("Add a meta description");
  }
  if (!product.featuredImage?.url) {
    tips.push("Add a product image");
  } else if (!product.featuredImage.altText?.trim()) {
    tips.push("Add alt text to the product image");
  }

  return tips.slice(0, 3);
}

export function buildDashboardStats(products: ProductNode[]): DashboardStats {
  const scores = products.map(scoreProduct);
  const optimized = scores.filter((s) => s >= 75).length;
  const avgSeoScore = scores.length
    ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
    : 0;

  const excellent = scores.filter((s) => s >= 80).length;
  const good = scores.filter((s) => s >= 60 && s < 80).length;
  const needsWork = scores.filter((s) => s >= 40 && s < 60).length;
  const poor = scores.filter((s) => s < 40).length;
  const total = products.length || 1;

  // Show products that most need AI first, then a few already optimized.
  const ranked = [...products]
    .map((product) => ({ product, seoScore: scoreProduct(product) }))
    .sort((a, b) => a.seoScore - b.seoScore || a.product.title.localeCompare(b.product.title));

  const needsAi = ranked.filter((item) => item.seoScore < 75).slice(0, 4);
  const alreadyOptimized = ranked
    .filter((item) => item.seoScore >= 75)
    .slice(0, Math.max(0, 5 - needsAi.length));

  const recentActivity = [...needsAi, ...alreadyOptimized].map(({ product, seoScore }) => ({
    id: product.id,
    title: product.title,
    type:
      seoScore >= 75
        ? "Title, description, and SEO meta look complete"
        : "Missing SEO meta or weak product content",
    status: seoScore >= 75 ? ("Optimized" as const) : ("Needs AI" as const),
    seoScore,
  }));

  return {
    totalProducts: products.length,
    productsOptimized: optimized,
    timeSavedHours: (optimized * 0.25).toFixed(1),
    avgSeoScore,
    ctrEstimate: Math.min(28, 8 + Math.round(optimized * 1.2)),
    seoBreakdown: {
      excellent: Math.round((excellent / total) * 100),
      good: Math.round((good / total) * 100),
      needsWork: Math.round((needsWork / total) * 100),
      poor: Math.round((poor / total) * 100),
    },
    recentActivity,
  };
}
