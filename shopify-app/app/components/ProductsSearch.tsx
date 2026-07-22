import { Form, Link } from "react-router";
import { buildProductsUrl, type ProductSort } from "../lib/products";

export function ProductsSearch({
  defaultQuery,
  sort,
}: {
  defaultQuery: string;
  sort: ProductSort;
}) {
  return (
    <Form method="get" action="/app/products" className="dashboard-product-search">
        <input
          type="search"
          name="q"
          defaultValue={defaultQuery}
          placeholder="Search by title, SKU, or tag..."
          className="dashboard-search-input"
          aria-label="Search products"
        />
        {sort !== "updated" ? <input type="hidden" name="sort" value={sort} /> : null}
        <button type="submit" className="dashboard-btn dashboard-btn-primary">
          Search
        </button>
        {defaultQuery ? (
          <Link
            to={buildProductsUrl({ sort })}
            className="dashboard-btn dashboard-btn-ghost"
          >
            Clear
          </Link>
        ) : null}
    </Form>
  );
}
