import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function scoreBadge(score) {
  if (score == null) return 'secondary';
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
}

export default function StoreOverview() {
  const { user, refreshUser } = useAuth();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [storeUrl, setStoreUrl] = useState('');
  const [visitorPassword, setVisitorPassword] = useState('');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const isPro = plan === 'pro';

  const loadStore = async () => {
    try {
      const res = await api.get('/store');
      setStore(res.data.store);
      if (res.data.store) {
        const productsRes = await api.get('/store/products');
        setProducts(productsRes.data.data || []);
      } else {
        setProducts([]);
      }
    } catch {
      setStore(null);
      setProducts([]);
    }
  };

  useEffect(() => {
    const loadPage = async () => {
      try {
        const [creditsRes, freshUser] = await Promise.all([
          api.get('/credits'),
          refreshUser().catch(() => null),
        ]);
        await loadStore();
        setPlan(creditsRes.data.plan ?? freshUser?.plan ?? 'free');
      } catch {
        setPlan('free');
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [refreshUser]);

  const handleConnect = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { store_url: storeUrl };
      if (visitorPassword.trim()) {
        payload.visitor_password = visitorPassword;
      }
      const res = await api.post('/store', payload);
      setStore(res.data.store);
      await loadStore();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not connect store.');
      if (err.response?.data?.store) {
        setStore(err.response.data.store);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRescan = async () => {
    setError('');
    setScanning(true);
    try {
      const payload = {};
      if (visitorPassword.trim()) {
        payload.visitor_password = visitorPassword;
      }
      const res = await api.post('/store/scan', payload);
      setStore(res.data.store);
      await loadStore();
    } catch (err) {
      setError(err.response?.data?.message || 'Store scan failed.');
      if (err.response?.data?.store) {
        setStore(err.response.data.store);
      }
    } finally {
      setScanning(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect this store?')) return;
    setError('');
    try {
      await api.delete('/store');
      setStore(null);
      setProducts([]);
      setStoreUrl('');
      setVisitorPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not disconnect store.');
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h3 className="mb-1">Store Overview</h3>
          <p className="text-muted mb-0">
            Connect your store URL to scan public product pages and review SEO scores in one place.
          </p>
        </div>
        {store && (
          <div className="d-flex gap-2">
            <Button variant="outline-primary" size="sm" onClick={handleRescan} disabled={scanning}>
              {scanning ? 'Scanning...' : 'Rescan Store'}
            </Button>
            <Button variant="outline-danger" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {!store ? (
        isPro ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-4">
            <h5 className="mb-3">Connect your store</h5>
            <p className="text-muted">
              Enter your store homepage URL. We read your public sitemap and audit up to 15 product pages.
              Works with Shopify, WooCommerce, and most stores with a standard sitemap.
            </p>
            <Form onSubmit={handleConnect} className="mt-3">
              <Row className="g-3">
                <Col md={8}>
                  <Form.Group>
                    <Form.Label>Store URL</Form.Label>
                    <Form.Control
                      type="url"
                      value={storeUrl}
                      onChange={(e) => setStoreUrl(e.target.value)}
                      placeholder="https://yourstore.com"
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>
                      Visitor password <span className="text-muted fw-normal">(optional)</span>
                    </Form.Label>
                    <Form.Control
                      type="password"
                      value={visitorPassword}
                      onChange={(e) => setVisitorPassword(e.target.value)}
                      placeholder="Development store password"
                      autoComplete="off"
                    />
                    <Form.Text className="text-muted">
                      If your store uses a visitor password, enter it here.
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col xs={12} className="d-flex justify-content-end">
                  <Button type="submit" variant="primary" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Connecting...
                      </>
                    ) : (
                      'Connect Store'
                    )}
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>
        ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-4 text-center">
            <Badge bg="primary" className="mb-3">Pro Feature</Badge>
            <h5 className="mb-3">Connect your store with Pro</h5>
            <p className="text-muted mb-4">
              Scan your public product pages, track SEO scores, and jump straight into audits from one dashboard.
            </p>
            <Link to="/pricing">
              <Button variant="primary">Upgrade to Pro</Button>
            </Link>
          </Card.Body>
        </Card>
        )
      ) : (
        <>
          {store.status === 'error' && store.error_message && (
            <Alert variant="warning">{store.error_message}</Alert>
          )}

          {(store.status === 'error' || store.has_visitor_password) && (
            <Card className="border-0 shadow-sm mb-4">
              <Card.Body className="p-4">
                <h6 className="mb-2">Visitor password</h6>
                <p className="text-muted small mb-3">
                  Development stores protected with a visitor password need the password saved here before scanning.
                </p>
                <Row className="g-2 align-items-end">
                  <Col md={6}>
                    <Form.Control
                      type="password"
                      value={visitorPassword}
                      onChange={(e) => setVisitorPassword(e.target.value)}
                      placeholder={store.has_visitor_password ? 'Saved — enter a new password to update' : 'Enter visitor password'}
                      autoComplete="off"
                    />
                  </Col>
                  <Col md="auto">
                    <Button variant="outline-primary" onClick={handleRescan} disabled={scanning}>
                      {scanning ? 'Scanning...' : 'Save & Rescan'}
                    </Button>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          )}

          <Row className="g-4 mb-4">
            <Col md={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <small className="text-muted">Store</small>
                  <div className="fw-semibold text-truncate">{store.store_url}</div>
                  <a href={store.store_url} target="_blank" rel="noreferrer" className="small">
                    Visit store →
                  </a>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <small className="text-muted">Products Scanned</small>
                  <h2 className="mb-0">{store.product_count}</h2>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <small className="text-muted">Average SEO Score</small>
                  <h2 className="mb-0">{store.avg_seo_score ?? '—'}</h2>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <small className="text-muted">Needs Improvement</small>
                  <h2 className="mb-0 text-danger">{store.needs_work_count ?? 0}</h2>
                  <small className="text-muted">Score below 60</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white fw-semibold d-flex justify-content-between align-items-center">
              <span>Product SEO Overview</span>
              {store.last_scanned_at && (
                <small className="text-muted fw-normal">
                  Last scan: {new Date(store.last_scanned_at).toLocaleString()}
                </small>
              )}
            </Card.Header>
            <Card.Body className="p-0">
              {products.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  No products scanned yet. Try rescanning your store.
                </div>
              ) : (
                <Table hover responsive className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SEO Score</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <div className="fw-semibold">{product.product_name || 'Unnamed product'}</div>
                          <a href={product.url} target="_blank" rel="noreferrer" className="small text-muted text-truncate d-block" style={{ maxWidth: 420 }}>
                            {product.url}
                          </a>
                        </td>
                        <td>
                          <Badge bg={scoreBadge(product.seo_score)}>
                            {product.seo_score != null ? `${product.seo_score}/100` : '—'}
                          </Badge>
                        </td>
                        <td>
                          {product.status === 'error' ? (
                            <span className="text-danger small">Scan failed</span>
                          ) : product.seo_score >= 80 ? (
                            <span className="text-success small">Good</span>
                          ) : (
                            <span className="text-warning small">Needs work</span>
                          )}
                        </td>
                        <td className="text-end">
                          <Link
                            to={`/seo-audit?url=${encodeURIComponent(product.url)}`}
                            className="btn btn-sm btn-outline-primary"
                          >
                            Audit & Fix
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
}
