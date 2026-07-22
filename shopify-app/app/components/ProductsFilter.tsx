import { Link } from "react-router";
import {
  buildProductsUrl,
  type ProductFilter,
  type ProductSort,
} from "../lib/products";

export function ProductsFilter({
  filter,
  search,
  sort,
}: {
  filter: ProductFilter;
  search: string;
  sort: ProductSort;
}) {
  const needsAi = filter === "needs_ai";

  return (
    <Link
      to={buildProductsUrl({
        q: search,
        sort,
        filter: needsAi ? "all" : "needs_ai",
      })}
      className={`dashboard-filter-chip${needsAi ? " is-active" : ""}`}
    >
      Needs AI only
    </Link>
  );
}
