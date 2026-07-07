import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Spinner, Button, Alert } from 'react-bootstrap';
import api from '../api/client';
import ProductResults from '../components/ProductResults';

export default function ProjectDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/products/${id}`)
      .then((res) => setProduct(res.data))
      .catch(() => setError('Project not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (error || !product) {
    return <Alert variant="danger">{error || 'Project not found.'}</Alert>;
  }

  const result = {
    product,
    content: product.generated_content,
    seo_score: product.seo_score,
    seo_checks: product.seo_checks,
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <Link to="/projects" className="small text-decoration-none">← Back to Projects</Link>
          <h3 className="mb-0 mt-1">{product.product_name || `Project #${product.id}`}</h3>
          <small className="text-muted">
            Saved {new Date(product.created_at).toLocaleString()}
          </small>
        </div>
        <Link to="/generator">
          <Button variant="outline-primary" size="sm">New Generation</Button>
        </Link>
      </div>

      <ProductResults result={result} />
    </div>
  );
}
