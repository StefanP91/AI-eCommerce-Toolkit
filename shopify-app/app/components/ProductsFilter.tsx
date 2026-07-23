import { Link } from "react-router";
import {
  buildProductsUrl,
  type ProductFilter,
  type ProductSort,
  type ProductStatusFilter,
} from "../lib/products";

export function ProductsFilter({
  filter,
  search,
  sort,
  status,
}: {
  filter: ProductFilter;
  search: string;
  sort: ProductSort;
  status: ProductStatusFilter;
}) {
  const needsAi = filter === "needs_ai";

  return (
    <Link
      to={buildProductsUrl({
        q: search,
        sort,
        filter: needsAi ? "all" : "needs_ai",
        status,
      })}
      className={`dashboard-filter-chip${needsAi ? " is-active" : ""}`}
    >
      Needs AI only
    </Link>
  );
}
