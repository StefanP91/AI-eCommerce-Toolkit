import type { ProductNode, ProductFilter, ProductSort } from "./products";
import {
  NEEDS_AI_SCORE_THRESHOLD,
  scoreProduct,
} from "./products";

export const PRODUCTS_PAGE_SIZE = 25;

type ShopifyAdmin = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type ProductBatch = {
  products: ProductNode[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
};

const PRODUCT_FIELDS = `
  id
  title
  handle
  descriptionHtml
  status
  featuredImage {
    url
    altText
  }
  seo {
    title
    description
  }
`;

function toShopifySearchQuery(search: string): string | null {
  const trimmed = search.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function fetchProductBatch(
  admin: ShopifyAdmin,
  first: number,
  after: string | null,
  search: string,
): Promise<ProductBatch> {
  const query = toShopifySearchQuery(search);

  const response = await admin.graphql(
    `#graphql
      query ProductList($first: Int!, $after: String, $query: String) {
        products(
          first: $first
          after: $after
          query: $query
          sortKey: UPDATED_AT
          reverse: true
        ) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              ${PRODUCT_FIELDS}
            }
          }
        }
      }`,
    { variables: { first, after, query } },
  );

  const json = await response.json();
  const connection = json.data?.products;

  return {
    products:
      connection?.edges?.map((edge: { node: ProductNode }) => edge.node) ?? [],
    pageInfo: {
      hasNextPage: connection?.pageInfo?.hasNextPage ?? false,
      endCursor: connection?.pageInfo?.endCursor ?? null,
    },
  };
}

async function fetchProductsCount(
  admin: ShopifyAdmin,
  search: string,
): Promise<number> {
  const query = toShopifySearchQuery(search);

  const response = await admin.graphql(
    `#graphql
      query ProductsCount($query: String) {
        productsCount(query: $query) {
          count
        }
      }`,
    { variables: { query } },
  );

  const json = await response.json();
  return json.data?.productsCount?.count ?? 0;
}

export type ProductsPageResult = {
  products: ProductNode[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  search: string;
  sort: ProductSort;
  filter: ProductFilter;
};

async function fetchAllProducts(
  admin: ShopifyAdmin,
  search: string,
): Promise<ProductNode[]> {
  const allProducts: ProductNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const batch = await fetchProductBatch(admin, 250, cursor, search);
    allProducts.push(...batch.products);
    hasNextPage = batch.pageInfo.hasNextPage;
    cursor = batch.pageInfo.endCursor;
  }

  return allProducts;
}

function sortProducts(
  products: ProductNode[],
  sort: ProductSort,
): ProductNode[] {
  if (sort === "updated") {
    return products;
  }

  const sorted = [...products];

  if (sort === "seo_desc") {
    sorted.sort(
      (a, b) =>
        scoreProduct(b) - scoreProduct(a) ||
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
  } else {
    sorted.sort(
      (a, b) =>
        scoreProduct(a) - scoreProduct(b) ||
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    );
  }

  return sorted;
}

function filterProducts(
  products: ProductNode[],
  filter: ProductFilter,
): ProductNode[] {
  if (filter !== "needs_ai") {
    return products;
  }
  return products.filter(
    (product) => scoreProduct(product) < NEEDS_AI_SCORE_THRESHOLD,
  );
}

function paginateProducts(
  products: ProductNode[],
  page: number,
  pageSize: number,
  search: string,
  sort: ProductSort,
  filter: ProductFilter,
): ProductsPageResult {
  const totalCount = products.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
  const targetPage = Math.min(Math.max(1, page), totalPages);
  const start = (targetPage - 1) * pageSize;

  return {
    products: products.slice(start, start + pageSize),
    page: targetPage,
    pageSize,
    totalCount,
    totalPages: totalCount === 0 ? 1 : totalPages,
    hasNextPage: targetPage < totalPages,
    hasPreviousPage: targetPage > 1,
    search,
    sort,
    filter,
  };
}

export async function fetchProductsPage(
  admin: ShopifyAdmin,
  page: number,
  search = "",
  sort: ProductSort = "updated",
  filter: ProductFilter = "all",
): Promise<ProductsPageResult> {
  const pageSize = PRODUCTS_PAGE_SIZE;
  const normalizedSearch = search.trim();
  const needsLocalPipeline = sort !== "updated" || filter !== "all";

  if (needsLocalPipeline) {
    const allProducts = sortProducts(
      filterProducts(await fetchAllProducts(admin, normalizedSearch), filter),
      sort === "updated" && filter === "needs_ai" ? "seo_asc" : sort,
    );

    return paginateProducts(
      allProducts,
      page,
      pageSize,
      normalizedSearch,
      sort,
      filter,
    );
  }

  const totalCount = await fetchProductsCount(admin, normalizedSearch);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const targetPage = Math.min(Math.max(1, page), totalPages);

  let cursor: string | null = null;
  for (let currentPage = 1; currentPage < targetPage; currentPage++) {
    const step = await fetchProductBatch(
      admin,
      pageSize,
      cursor,
      normalizedSearch,
    );
    if (!step.pageInfo.hasNextPage) {
      break;
    }
    cursor = step.pageInfo.endCursor;
  }

  const result = await fetchProductBatch(
    admin,
    pageSize,
    cursor,
    normalizedSearch,
  );

  return {
    products: result.products,
    page: targetPage,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage: result.pageInfo.hasNextPage,
    hasPreviousPage: targetPage > 1,
    search: normalizedSearch,
    sort,
    filter,
  };
}

export async function fetchProducts(admin: ShopifyAdmin): Promise<ProductNode[]> {
  const response = await admin.graphql(
    `#graphql
      query ProductList {
        products(first: 50, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              ${PRODUCT_FIELDS}
            }
          }
        }
      }`,
  );

  const json = await response.json();
  return (
    json.data?.products?.edges?.map((edge: { node: ProductNode }) => edge.node) ??
    []
  );
}
