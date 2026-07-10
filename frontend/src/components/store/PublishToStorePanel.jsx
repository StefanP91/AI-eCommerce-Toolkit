import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Row } from 'react-bootstrap';
import api from '../../api/client';
import { PLATFORM_EXPORTS } from '../../constants/platformExports';
import { MANUAL_PUBLISH_STEPS } from '../../constants/storePublish';
import { downloadExport } from '../../utils/download';
import { getStorePlatform } from '../../constants/storePlatforms';
import ShopifyConnectButton from './ShopifyConnectButton';
import StorePlatformLogo from './StorePlatformLogo';

export default function PublishToStorePanel({
  productId = null,
  storeProductUrl = null,
  onCopyAll,
  store = null,
  compact = false,
  onPushSuccess = null,
}) {
  const [exporting, setExporting] = useState('');
  const [copied, setCopied] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState(null);
  const [pushError, setPushError] = useState('');

  const platformConfig = store?.platform ? getStorePlatform(store.platform) : null;
  const isShopify = store?.platform === 'shopify';
  const showShopifyPush = isShopify;
  const showShopifyOAuth = isShopify && store?.shopify_oauth_enabled !== false;
  const platformExports = store?.platform
    ? PLATFORM_EXPORTS.filter((item) => item.format === store.platform)
    : PLATFORM_EXPORTS;
  const exportOptions = platformExports.length > 0 ? platformExports : PLATFORM_EXPORTS;

  const handleCopyAll = async () => {
    if (!onCopyAll) return;
    await onCopyAll();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async (format) => {
    if (!productId) return;
    setExporting(format);
    try {
      await downloadExport(productId, format);
    } finally {
      setExporting('');
    }
  };

  const handlePush = async () => {
    if (!productId) return;
    setPushing(true);
    setPushError('');
    setPushResult(null);
    try {
      const res = await api.post(`/products/${productId}/push-to-store`, {
        store_product_url: storeProductUrl || undefined,
      });
      setPushResult(res.data);
      onPushSuccess?.(res.data);
    } catch (err) {
      setPushError(err.response?.data?.message || 'Could not push product to Shopify.');
    } finally {
      setPushing(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm mb-4">
      <Card.Body className="p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h5 className="mb-1">Publish to your store</h5>
            <p className="text-muted small mb-0">
              Choose the option that fits your workflow. Manual copy/export works for everyone.
            </p>
          </div>
          <Badge bg="primary">Recommended</Badge>
        </div>

        <Row className="g-3">
          <Col lg={compact ? 12 : 4}>
            <Card className="h-100 border">
              <Card.Body>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <Badge bg="success">Level 1</Badge>
                  <strong>Copy or export</strong>
                </div>
                <p className="text-muted small">
                  No technical setup. Copy the content or download a platform-ready file.
                </p>
                <ol className="small text-muted ps-3 mb-3">
                  {MANUAL_PUBLISH_STEPS.map((step) => (
                    <li key={step} className="mb-1">{step}</li>
                  ))}
                </ol>
                <div className="d-flex gap-2 flex-wrap">
                  {onCopyAll && (
                    <Button variant="outline-primary" size="sm" onClick={handleCopyAll}>
                      {copied ? 'Copied!' : 'Copy All'}
                    </Button>
                  )}
                  {productId && exportOptions.map((item) => (
                    <Button
                      key={item.format}
                      variant="outline-secondary"
                      size="sm"
                      disabled={exporting === item.format}
                      onClick={() => handleExport(item.format)}
                    >
                      {exporting === item.format ? 'Exporting...' : item.label}
                    </Button>
                  ))}
                </div>
                {!productId && (
                  <Alert variant="light" className="small mb-0 mt-3 py-2">
                    Save the project first to unlock platform export files.
                  </Alert>
                )}
              </Card.Body>
            </Card>
          </Col>

          {showShopifyPush && (
          <Col lg={compact ? 12 : 4}>
            <Card className="h-100 border">
              <Card.Body>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <Badge bg="warning" text="dark">Level 2</Badge>
                  <strong>{store?.push_available ? 'Push to store' : 'Connect store'}</strong>
                </div>
                {store?.push_available ? (
                  <>
                    <p className="text-muted small">
                      Publish directly to your connected Shopify store with one click.
                    </p>
                    <Alert variant="success" className="small py-2 mb-3">
                      API connected for <strong>{store.platform}</strong>
                      {store.connection_method === 'oauth' ? ' via OAuth' : ''}.
                      {productId && ' Ready to push.'}
                    </Alert>
                    {productId && (
                      <div className="mb-3">
                        <Button variant="primary" size="sm" onClick={handlePush} disabled={pushing}>
                          {pushing ? 'Pushing & rescanning...' : 'Push to Shopify'}
                        </Button>
                        {pushResult && (
                          <Alert variant="success" className="small mt-2 mb-0 py-2">
                            {pushResult.message}{' '}
                            {pushResult.shopify?.action === 'updated' && '(updated existing product) '}
                            {pushResult.shopify?.admin_url && (
                              <a href={pushResult.shopify.admin_url} target="_blank" rel="noreferrer">
                                View in Shopify Admin
                              </a>
                            )}
                          </Alert>
                        )}
                        {pushError && (
                          <Alert variant="danger" className="small mt-2 mb-0 py-2">{pushError}</Alert>
                        )}
                      </div>
                    )}
                    {!productId && (
                      <Alert variant="light" className="small mb-0 py-2">
                        Save the project first to push to Shopify.
                      </Alert>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-muted small">
                      Connect your Shopify admin API or sign in with OAuth to enable one-click push.
                    </p>
                    <p className="small text-muted mb-3">
                      Until then, use copy or export above and paste into Shopify admin.
                    </p>
                    <Link to="/store#guided-api-setup">
                      <Button variant="primary" size="sm">
                        Connect store
                      </Button>
                    </Link>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
          )}

          {!isShopify && platformConfig && (
          <Col lg={compact ? 12 : 4}>
            <Card className="h-100 border">
              <Card.Body>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <StorePlatformLogo platformId={platformConfig.id} size={22} />
                  <Badge bg="warning" text="dark">Level 2</Badge>
                  <strong>Update in {platformConfig.label}</strong>
                </div>
                <p className="text-muted small">
                  One-click push is not available for {platformConfig.label} yet.
                  Export optimized content and paste it in your store admin.
                </p>
                <ol className="small text-muted ps-3 mb-3">
                  {platformConfig.publishSteps.map((step) => (
                    <li key={step} className="mb-1">{step}</li>
                  ))}
                </ol>
                <Link to="/store#guided-api-setup">
                  <Button variant="outline-primary" size="sm">
                    Open guided setup
                  </Button>
                </Link>
              </Card.Body>
            </Card>
          </Col>
          )}

          {showShopifyOAuth && (
          <Col lg={compact ? 12 : 4}>
            <Card className="h-100 border bg-light">
              <Card.Body>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <Badge bg="secondary">Level 3</Badge>
                  <strong>One-click connect</strong>
                </div>
                <p className="text-muted small">
                  Sign in with Shopify and approve access. No API keys to copy.
                </p>
                <ShopifyConnectButton
                  store={store}
                  defaultShop={
                    store?.store_url?.includes('myshopify.com')
                      ? store.store_url.replace(/^https?:\/\//, '').split('/')[0]
                      : ''
                  }
                />
              </Card.Body>
            </Card>
          </Col>
          )}
        </Row>
      </Card.Body>
    </Card>
  );
}
