import { useNavigate } from "react-router";
import {
  PRODUCT_STATUS_OPTIONS,
  buildProductsUrl,
  type ProductFilter,
  type ProductSort,
  type ProductStatusFilter,
} from "../lib/products";

export function ProductsStatusFilter({
  status,
  search,
  sort,
  filter,
}: {
  status: ProductStatusFilter;
  search: string;
  sort: ProductSort;
  filter: ProductFilter;
}) {
  const navigate = useNavigate();

  return (
    <label className="dashboard-product-sort">
      <span className="dashboard-product-sort-label">Status</span>
      <select
        className="dashboard-sort-select"
        value={status}
        aria-label="Filter by product status"
        onChange={(event) => {
          navigate(
            buildProductsUrl({
              q: search,
              sort,
              filter,
              status: event.target.value as ProductStatusFilter,
            }),
          );
        }}
      >
        {PRODUCT_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
