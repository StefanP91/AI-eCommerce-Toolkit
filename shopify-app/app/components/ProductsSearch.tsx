import { Form, Link } from "react-router";

export function ProductsSearch({ defaultQuery }: { defaultQuery: string }) {
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
      <button type="submit" className="dashboard-btn dashboard-btn-primary">
        Search
      </button>
      {defaultQuery ? (
        <Link to="/app/products" className="dashboard-btn dashboard-btn-ghost">
          Clear
        </Link>
      ) : null}
    </Form>
  );
}
