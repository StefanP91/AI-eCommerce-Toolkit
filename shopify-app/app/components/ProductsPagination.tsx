import { Link } from "react-router";

export function ProductsPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  hasPreviousPage,
  hasNextPage,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}) {
  if (totalCount === 0) {
    return null;
  }

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  return (
    <div className="dashboard-pagination-wrap">
      <p className="dashboard-pagination-summary">
        Showing {rangeStart}–{rangeEnd} of {totalCount} products
      </p>

      {totalPages > 1 && (
        <nav className="dashboard-pagination" aria-label="Products pagination">
          {hasPreviousPage ? (
            <Link
              to={page === 2 ? "/app/products" : `/app/products?page=${page - 1}`}
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
              to={`/app/products?page=${page + 1}`}
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
