import { useNavigate } from "react-router";
import {
  PRODUCT_SORT_OPTIONS,
  buildProductsUrl,
  type ProductFilter,
  type ProductSort,
} from "../lib/products";

export function ProductsSort({
  sort,
  search,
  filter,
}: {
  sort: ProductSort;
  search: string;
  filter: ProductFilter;
}) {
  const navigate = useNavigate();

  return (
    <label className="dashboard-product-sort">
      <span className="dashboard-product-sort-label">Sort by</span>
      <select
        className="dashboard-sort-select"
        value={sort}
        aria-label="Sort products"
        onChange={(event) => {
          navigate(
            buildProductsUrl({
              q: search,
              sort: event.target.value as ProductSort,
              filter,
            }),
          );
        }}
      >
        {PRODUCT_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
