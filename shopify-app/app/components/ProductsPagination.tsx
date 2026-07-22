import { Link } from "react-router";
import { buildProductsUrl, type ProductSort } from "../lib/products";

export function ProductsPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  hasPreviousPage,
  hasNextPage,
  search,
  sort,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  search: string;
  sort: ProductSort;
}) {
  if (totalCount === 0) {
    return null;
  }

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const summaryLabel = search
    ? `Showing ${rangeStart}–${rangeEnd} of ${totalCount} results for "${search}"`
    : `Showing ${rangeStart}–${rangeEnd} of ${totalCount} products`;

  return (
    <div className="dashboard-pagination-wrap">
      <p className="dashboard-pagination-summary">{summaryLabel}</p>

      {totalPages > 1 && (
        <nav className="dashboard-pagination" aria-label="Products pagination">
          {hasPreviousPage ? (
            <Link
              to={buildProductsUrl({ page: page - 1, q: search, sort })}
              className="dashboard-btn dashboard-btn-ghost"
            >
              Previous
            </Link>
          ) : (
            <span className="dashboard-btn dashboard-btn-ghost dashboard-btn-disabled">
              Previous
            </span>
          )}

          <span className="dashboard-pagination-status">
            Page {page} of {totalPages}
          </span>

          {hasNextPage ? (
            <Link
              to={buildProductsUrl({ page: page + 1, q: search, sort })}
              className="dashboard-btn dashboard-btn-ghost"
            >
              Next
            </Link>
          ) : (
            <span className="dashboard-btn dashboard-btn-ghost dashboard-btn-disabled">
              Next
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
