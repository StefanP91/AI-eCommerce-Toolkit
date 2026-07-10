import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import StorePlatformPicker from '../components/store/StorePlatformPicker';
import StorePlatformConnect from '../components/store/StorePlatformConnect';
import VisitorPasswordInput from '../components/store/VisitorPasswordInput';
import StorePlatformLogo from '../components/store/StorePlatformLogo';
import { getStorePlatform } from '../constants/storePlatforms';
import { validateStoreUrlForPlatform } from '../utils/storePlatformUrl';
import StoreApiSetup from '../components/store/StoreApiSetup';
import StoreProductAuditFix from '../components/store/StoreProductAuditFix';
import StoreProductTableToolbar, { MAX_BULK_SEO_SELECT } from '../components/store/StoreProductTableToolbar';
import StoreBulkSeoProgress from '../components/store/StoreBulkSeoProgress';
import PublishToStorePanel from '../components/store/PublishToStorePanel';
import { notifyCreditsUpdated } from '../utils/credits';

const GENERATE_DEFAULTS = {
  language: 'en',
  tone: 'professional',
  target_country: 'US',
  category: 'General',
};

function matchesProductSearch(product, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const name = (product.product_name || '').toLowerCase();
  const url = (product.url || '').toLowerCase();
  const slug = url.split('/').pop() || '';

  return name.includes(q) || url.includes(q) || slug.includes(q);
}

const BULK_PROJECTS_STORAGE_KEY = 'store_bulk_project_by_url';

function normalizeUrlKey(url) {
  try {
    const raw = (url || '').trim();
    if (!raw) return '';
    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const path = parsed.pathname.replace(/\/$/, '').toLowerCase();

    return `${host}${path}`;
  } catch {
    return (url || '').replace(/\/$/, '').toLowerCase().split('?')[0];
  }
}

function storeProductScorePatch(source) {
  if (!source) return null;

  return {
    seo_score: source.seo_score,
    seo_checks: source.seo_checks,
    status: source.status,
    error_message: source.error_message,
    last_scanned_at: source.last_scanned_at,
    product_name: source.product_name,
  };
}

function applyStoreProductMerge(item, mergeProduct) {
  if (!mergeProduct) return item;

  if (item.id === mergeProduct.id) {
    return { ...item, ...mergeProduct };
  }

  const itemKey = normalizeUrlKey(item.url);
  const mergeKey = normalizeUrlKey(mergeProduct.url);
  if (itemKey && mergeKey && itemKey === mergeKey) {
    return { ...item, ...storeProductScorePatch(mergeProduct) };
  }

  return item;
}

function scoreBadge(score) {
  if (score == null) return 'secondary';
  if (score >= 90) return 'success';
  if (score >= 70) return 'warning';
  return 'danger';
}

export default function StoreOverview() {
  const { user, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [storeUrl, setStoreUrl] = useState('');
  const [visitorPassword, setVisitorPassword] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [connectUrlError, setConnectUrlError] = useState('');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [oauthMessage, setOauthMessage] = useState('');
  const [auditProduct, setAuditProduct] = useState(null);
  const [auditSessionKey, setAuditSessionKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [seoSort, setSeoSort] = useState('default');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkMode, setBulkMode] = useState(null);
  const [bulkItems, setBulkItems] = useState([]);
  const [bulkIndex, setBulkIndex] = useState(0);
  const [bulkError, setBulkError] = useState('');
  const [selectionNotice, setSelectionNotice] = useState('');
  const [bulkProjectByUrl, setBulkProjectByUrl] = useState(() => {
    try {
      const saved = sessionStorage.getItem(BULK_PROJECTS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [bulkCompletedAction, setBulkCompletedAction] = useState(null);

  const persistBulkProjectMap = (updater) => {
    setBulkProjectByUrl((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      try {
        sessionStorage.setItem(BULK_PROJECTS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const isPro = plan === 'pro';

  const filteredProducts = useMemo(() => {
    const matched = products.filter((product) => matchesProductSearch(product, searchQuery));

    if (seoSort === 'worst') {
      return [...matched].sort((a, b) => (a.seo_score ?? -1) - (b.seo_score ?? -1));
    }

    if (seoSort === 'best') {
      return [...matched].sort((a, b) => (b.seo_score ?? -1) - (a.seo_score ?? -1));
    }

    return matched;
  }, [products, searchQuery, seoSort]);

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedIds.has(product.id)),
    [products, selectedIds],
  );

  const allVisibleSelected = filteredProducts.length > 0
    && filteredProducts
      .slice(0, MAX_BULK_SEO_SELECT)
      .every((product) => selectedIds.has(product.id));

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
        setProducts((current) => current.map((item) => applyStoreProductMerge(item, mergeProduct)));
      } else if (nextStore && !skipProductsRefetch) {
        const productsRes = await api.get('/store/products');
        setProducts(productsRes.data.data || []);
      } else if (!nextStore) {
        setProducts([]);
      }

      if (mergeProduct) {
        setAuditProduct((current) => {
          if (!current) return null;
          return applyStoreProductMerge(current, mergeProduct);
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
    setConnectUrlError('');

    if (!selectedPlatform) {
      setConnectUrlError('Choose a platform before connecting your store URL.');
      return;
    }

    const urlCheck = validateStoreUrlForPlatform(storeUrl, selectedPlatform);
    if (!urlCheck.valid) {
      setConnectUrlError(urlCheck.message);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        store_url: storeUrl,
        platform: selectedPlatform,
      };
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
      setSelectedPlatform(null);
      setSelectedIds(new Set());
      setSearchQuery('');
      setSeoSort('default');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not disconnect store.');
    }
  };

  const toggleProductSelection = (productId) => {
    setSelectionNotice('');
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
        return next;
      }
      if (next.size >= MAX_BULK_SEO_SELECT) {
        setSelectionNotice(`You can select up to ${MAX_BULK_SEO_SELECT} products for bulk SEO.`);
        return current;
      }
      next.add(productId);
      return next;
    });
  };

  const handleSelectAllFiltered = (checked) => {
    setSelectionNotice('');
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }

    const next = new Set();
    for (const product of filteredProducts) {
      if (next.size >= MAX_BULK_SEO_SELECT) break;
      next.add(product.id);
    }
    if (filteredProducts.length > MAX_BULK_SEO_SELECT) {
      setSelectionNotice(`Only the first ${MAX_BULK_SEO_SELECT} visible products were selected.`);
    }
    setSelectedIds(next);
  };

  const mergeStoreProduct = (mergeProduct) => {
    if (!mergeProduct) return;
    setProducts((current) => current.map((item) => applyStoreProductMerge(item, mergeProduct)));
  };

  const applyAuditScoreToUrl = (url, auditData) => {
    const key = normalizeUrlKey(url);
    if (!key || auditData?.score == null) return;

    setProducts((current) => current.map((item) => (
      normalizeUrlKey(item.url) === key
        ? { ...item, seo_score: auditData.score, status: 'scanned' }
        : item
    )));
  };

  const handleBulkAudit = async () => {
    if (selectedProducts.length === 0) return;

    setBulkError('');
    setBulkCompletedAction(null);
    setBulkMode('audit');
    setBulkItems(selectedProducts);
    setBulkIndex(0);

    try {
      for (let index = 0; index < selectedProducts.length; index += 1) {
        const product = selectedProducts[index];
        setBulkIndex(index);
        const res = await api.post('/store/audit-url', {
          product_url: product.url,
          bust_cache: true,
        });
        mergeStoreProduct(res.data.store_product);
        if (res.data.store) {
          setStore(res.data.store);
        }
      }
      setBulkIndex(selectedProducts.length);
      setBulkCompletedAction('audit');
    } catch (err) {
      setBulkError(err.response?.data?.message || 'Bulk audit failed. Please try again.');
      setBulkIndex(selectedProducts.length);
    } finally {
      setBulkMode(null);
    }
  };

  const handleBulkFix = async () => {
    if (selectedProducts.length === 0) return;

    const needsWork = selectedProducts.filter((product) => (product.seo_score ?? 0) < 90);
    const targets = needsWork.length > 0 ? needsWork : selectedProducts;

    if (!window.confirm(
      `Run AI SEO fix for ${targets.length} product${targets.length === 1 ? '' : 's'}?`,
    )) {
      return;
    }

    setBulkError('');
    setBulkCompletedAction(null);
    setBulkMode('fix');
    setBulkItems(targets);
    setBulkIndex(0);

    try {
      for (let index = 0; index < targets.length; index += 1) {
        const product = targets[index];
        setBulkIndex(index);

        const generateRes = await api.post('/products/generate', {
          input_type: 'url',
          product_url: product.url,
          product_name: product.product_name,
          ...GENERATE_DEFAULTS,
        });

        const saveRes = await api.post('/products', {
          ...generateRes.data.input,
          product_url: product.url,
          product_name: product.product_name || generateRes.data.input?.product_name,
          generated_content: generateRes.data.content,
          seo_score: generateRes.data.seo_score,
          seo_checks: generateRes.data.seo_checks,
          history_id: generateRes.data.history_id,
        });

        persistBulkProjectMap((prev) => ({
          ...prev,
          [normalizeUrlKey(product.url)]: saveRes.data.product.id,
        }));

        notifyCreditsUpdated();

        const auditRes = await api.post('/store/audit-url', {
          product_url: product.url,
          bust_cache: true,
        });
        mergeStoreProduct(auditRes.data.store_product);
        if (auditRes.data.store) {
          setStore(auditRes.data.store);
        }
      }

      setBulkIndex(targets.length);
      setBulkCompletedAction('fix');
    } catch (err) {
      setBulkError(err.response?.data?.message || 'Bulk SEO fix failed. Please try again.');
      setBulkIndex(targets.length);
    } finally {
      setBulkMode(null);
    }
  };

  const dismissBulkProgress = () => {
    setBulkItems([]);
    setBulkIndex(0);
    setBulkError('');
    setBulkCompletedAction(null);
  };

  const clearBulkSelection = () => {
    setSelectedIds(new Set());
    setSelectionNotice('');
  };

  const finishBulkPush = () => {
    clearBulkSelection();
    dismissBulkProgress();
  };

  const getProjectIdForStoreProduct = (storeProduct) => (
    bulkProjectByUrl[normalizeUrlKey(storeProduct.url)]
  );

  const resolveProjectIdForStoreProduct = async (storeProduct) => {
    const cached = getProjectIdForStoreProduct(storeProduct);
    if (cached) return cached;

    try {
      const res = await api.get('/products/by-url', { params: { url: storeProduct.url } });
      const projectId = res.data.product?.id;
      if (projectId) {
        persistBulkProjectMap((prev) => ({
          ...prev,
          [normalizeUrlKey(storeProduct.url)]: projectId,
        }));
        return projectId;
      }
    } catch {
      // no saved project for this URL
    }

    return null;
  };

  const resolvePushTargets = async (storeProducts) => {
    const seen = new Set();
    const targets = [];

    for (const storeProduct of storeProducts) {
      const key = normalizeUrlKey(storeProduct.url);
      if (!key || seen.has(key)) continue;

      const projectId = await resolveProjectIdForStoreProduct(storeProduct);
      if (!projectId) continue;

      seen.add(key);
      targets.push({ storeProduct, projectId });
    }

    return targets;
  };

  const selectedPushableCount = useMemo(
    () => selectedProducts.filter((product) => getProjectIdForStoreProduct(product)).length,
    [selectedProducts, bulkProjectByUrl],
  );
  const bulkPushableCount = useMemo(
    () => bulkItems.filter((product) => getProjectIdForStoreProduct(product)).length,
    [bulkItems, bulkProjectByUrl],
  );

  const handleBulkPush = async (storeProducts) => {
    const targets = await resolvePushTargets(storeProducts);

    if (!store?.push_available) {
      setError('Connect your Shopify store API first in the guided setup below.');
      return;
    }

    if (targets.length === 0) {
      setSelectionNotice('Run Fix SEO on selected products first, then push to Shopify.');
      return;
    }

    if (!window.confirm(
      `Push ${targets.length} product${targets.length === 1 ? '' : 's'} to Shopify?`,
    )) {
      return;
    }

    setBulkError('');
    setBulkCompletedAction(null);
    setBulkMode('push');
    setBulkItems(targets.map((entry) => entry.storeProduct));
    setBulkIndex(0);

    try {
      for (let index = 0; index < targets.length; index += 1) {
        const { storeProduct, projectId } = targets[index];
        setBulkIndex(index);

        const pushRes = await api.post(`/products/${projectId}/push-to-store`, {
          store_product_url: storeProduct.url,
        });

        if (pushRes.data.store_product) {
          mergeStoreProduct(pushRes.data.store_product);
        } else {
          const auditRes = await api.post('/store/audit-url', {
            product_url: storeProduct.url,
            bust_cache: true,
          });
          if (auditRes.data.store_product) {
            mergeStoreProduct(auditRes.data.store_product);
          } else {
            applyAuditScoreToUrl(storeProduct.url, auditRes.data);
          }
        }

        if (pushRes.data.store) {
          setStore(pushRes.data.store);
        }
      }

      await loadStore();
      finishBulkPush();
    } catch (err) {
      setBulkError(err.response?.data?.message || 'Bulk push to Shopify failed. Please try again.');
      setBulkIndex(targets.length);
    } finally {
      setBulkMode(null);
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
          !selectedPlatform ? (
            <StorePlatformPicker onSelect={setSelectedPlatform} />
          ) : (
            <StorePlatformConnect
              platformId={selectedPlatform}
              storeUrl={storeUrl}
              onStoreUrlChange={(value) => {
                setStoreUrl(value);
                setConnectUrlError('');
              }}
              visitorPassword={visitorPassword}
              onVisitorPasswordChange={setVisitorPassword}
              submitting={submitting}
              onSubmit={handleConnect}
              onBack={() => {
                setSelectedPlatform(null);
                setConnectUrlError('');
              }}
              urlError={connectUrlError}
            />
          )
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
                  {store.platform && (
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <StorePlatformLogo platformId={store.platform} size={20} />
                      <span className="small fw-semibold">
                        {getStorePlatform(store.platform)?.label ?? store.platform}
                      </span>
                    </div>
                  )}
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

              {bulkItems.length > 0 && (
                <StoreBulkSeoProgress
                  mode={bulkMode}
                  items={bulkItems}
                  currentIndex={bulkIndex}
                  currentLabel={bulkItems[bulkIndex]?.product_name || bulkItems[bulkIndex]?.url || ''}
                  error={bulkError}
                  onDismiss={dismissBulkProgress}
                  canPush={Boolean(store?.push_available)}
                  pushableCount={bulkPushableCount}
                  onPush={() => handleBulkPush(bulkItems)}
                  pushRunning={bulkMode === 'push'}
                  completedAction={bulkCompletedAction}
                />
              )}

              {products.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  No products scanned yet. Try rescanning your store.
                </div>
              ) : (
                <>
                  <StoreProductTableToolbar
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    seoSort={seoSort}
                    onSeoSortChange={setSeoSort}
                    filteredCount={filteredProducts.length}
                    totalCount={products.length}
                    selectedCount={selectedIds.size}
                    onSelectAllFiltered={handleSelectAllFiltered}
                    onClearSelection={clearBulkSelection}
                    onBulkAudit={handleBulkAudit}
                    onBulkFix={handleBulkFix}
                    onBulkPush={() => handleBulkPush(selectedProducts)}
                    pushAvailable={Boolean(store?.push_available)}
                    pushableCount={selectedPushableCount}
                    bulkRunning={Boolean(bulkMode)}
                    bulkMode={bulkMode}
                    allVisibleSelected={allVisibleSelected}
                  />

                  {selectionNotice && (
                    <div className="px-3 pb-2">
                      <Alert variant="info" className="py-2 small mb-0">{selectionNotice}</Alert>
                    </div>
                  )}

                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      No products match &quot;{searchQuery.trim()}&quot;.
                    </div>
                  ) : (
                <Table hover responsive className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: 42 }} />
                      <th>Product</th>
                      <th>SEO Score</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className={selectedIds.has(product.id) ? 'table-primary' : undefined}>
                        <td>
                          <Form.Check
                            type="checkbox"
                            checked={selectedIds.has(product.id)}
                            onChange={() => toggleProductSelection(product.id)}
                            disabled={Boolean(bulkMode) || (!selectedIds.has(product.id) && selectedIds.size >= MAX_BULK_SEO_SELECT)}
                            aria-label={`Select ${product.product_name || 'product'}`}
                          />
                        </td>
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
                </>
              )}
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
}
