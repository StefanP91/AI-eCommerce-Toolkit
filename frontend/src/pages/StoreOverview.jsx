import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import PublishToStorePanel from '../components/store/PublishToStorePanel';
import StoreApiSetup from '../components/store/StoreApiSetup';
import StoreProductAuditFix from '../components/store/StoreProductAuditFix';

function scoreBadge(score) {
  if (score == null) return 'secondary';
  if (score >= 90) return 'success';
  if (score >= 70) return 'warning';
  return 'danger';
}

function EyeIcon({ slashed = false }) {
  if (slashed) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 3l18 18M10.58 10.58A2 2 0 0 0 12 15a2 2 0 0 0 1.42-.58M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8-1.02 2.79-2.97 5.08-5.45 6.45M6.61 6.61C4.55 7.88 2.97 9.79 2 12c1.73 4.89 6 8 10 8 1.55 0 3.03-.35 4.36-.97"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function VisitorPasswordInput({ value, onChange, placeholder, id }) {
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup>
      <Form.Control
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
      />
      <Button
        variant="outline-secondary"
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
      >
        <EyeIcon slashed={visible} />
      </Button>
    </InputGroup>
  );
}

export default function StoreOverview() {
  const { user, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [storeUrl, setStoreUrl] = useState('');
  const [visitorPassword, setVisitorPassword] = useState('');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [oauthMessage, setOauthMessage] = useState('');
  const [auditProduct, setAuditProduct] = useState(null);
  const [auditSessionKey, setAuditSessionKey] = useState(0);

  const isPro = plan === 'pro';

  const loadStore = async ({
    store: storeData = null,
    products: productsData = null,
    mergeProduct = null,
    skipProductsRefetch = false,
  } = {}) => {
    try {
      let nextStore = storeData;
      if (!nextStore) {
        const res = await api.get('/store');
        nextStore = res.data.store;
      }
      setStore(nextStore);

      if (productsData) {
        setProducts(productsData);
      } else if (mergeProduct) {
        setProducts((current) => current.map((item) => {
          if (item.id === mergeProduct.id) {
            return { ...item, ...mergeProduct };
          }

          const itemUrl = (item.url || '').replace(/\/$/, '').toLowerCase();
          const mergeUrl = (mergeProduct.url || '').replace(/\/$/, '').toLowerCase();
          if (itemUrl && mergeUrl && itemUrl === mergeUrl) {
            return { ...item, ...mergeProduct };
          }

          return item;
        }));
      } else if (nextStore && !skipProductsRefetch) {
        const productsRes = await api.get('/store/products');
        setProducts(productsRes.data.data || []);
      } else if (!nextStore) {
        setProducts([]);
      }

      if (mergeProduct) {
        setAuditProduct((current) => {
          if (!current) return null;
          if (current.id === mergeProduct.id) {
            return { ...current, ...mergeProduct };
          }

          const currentUrl = (current.url || '').replace(/\/$/, '').toLowerCase();
          const mergeUrl = (mergeProduct.url || '').replace(/\/$/, '').toLowerCase();
          if (currentUrl && mergeUrl && currentUrl === mergeUrl) {
            return { ...current, ...mergeProduct };
          }

          return current;
        });
      } else if (productsData) {
        setAuditProduct((current) => {
          if (!current) return null;
          return productsData.find((item) => item.id === current.id) ?? current;
        });
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

  useEffect(() => {
    const shopifyStatus = searchParams.get('shopify');
    if (!shopifyStatus) return;

    if (shopifyStatus === 'connected') {
      setOauthMessage('Shopify store connected successfully via OAuth.');
      loadStore();
    } else if (shopifyStatus === 'error') {
      setError(searchParams.get('message') || 'Shopify connection failed.');
    }

    searchParams.delete('shopify');
    searchParams.delete('message');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

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
      {oauthMessage && <Alert variant="success">{oauthMessage}</Alert>}

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
                    <VisitorPasswordInput
                      id="connect-visitor-password"
                      value={visitorPassword}
                      onChange={(e) => setVisitorPassword(e.target.value)}
                      placeholder="Development store password"
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
                    <VisitorPasswordInput
                      id="rescan-visitor-password"
                      value={visitorPassword}
                      onChange={(e) => setVisitorPassword(e.target.value)}
                      placeholder={store.has_visitor_password ? 'Saved — enter a new password to update' : 'Enter visitor password'}
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

          {isPro && (
            <>
              <PublishToStorePanel store={store} compact />
              <StoreApiSetup
                store={store}
                onUpdated={(updatedStore) => setStore(updatedStore)}
              />
            </>
          )}

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
              {auditProduct && (
                <div className="p-3 border-bottom bg-light">
                  <StoreProductAuditFix
                    key={`${auditProduct.id}-${auditProduct.seo_score}-${auditSessionKey}`}
                    product={auditProduct}
                    store={store}
                    onClose={() => setAuditProduct(null)}
                    onStoreRefresh={loadStore}
                  />
                </div>
              )}
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
                          ) : product.seo_score >= 90 ? (
                            <span className="text-success small">Good</span>
                          ) : (
                            <span className="text-warning small">Needs work</span>
                          )}
                        </td>
                        <td className="text-end">
                          <Button
                            variant={auditProduct?.id === product.id ? 'primary' : 'outline-primary'}
                            size="sm"
                            onClick={() => {
                              setAuditProduct(product);
                              setAuditSessionKey(Date.now());
                            }}
                          >
                            Audit &amp; Fix
                          </Button>
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
