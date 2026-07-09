import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Row } from 'react-bootstrap';
import { PLATFORM_EXPORTS } from '../../constants/platformExports';
import { MANUAL_PUBLISH_STEPS } from '../../constants/storePublish';
import { downloadExport } from '../../utils/download';
import ShopifyConnectButton from './ShopifyConnectButton';

export default function PublishToStorePanel({
  productId = null,
  onCopyAll,
  store = null,
  compact = false,
}) {
  const [exporting, setExporting] = useState('');
  const [copied, setCopied] = useState(false);

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
                  {productId && PLATFORM_EXPORTS.map((item) => (
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

          <Col lg={compact ? 12 : 4}>
            <Card className="h-100 border">
              <Card.Body>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <Badge bg="warning" text="dark">Level 2</Badge>
                  <strong>Guided API setup</strong>
                </div>
                <p className="text-muted small">
                  For automatic publishing later. We walk you through creating API keys step by step.
                </p>
                {store?.has_api_connection ? (
                  <Alert variant="success" className="small py-2 mb-3">
                    API connected for <strong>{store.platform}</strong>
                    {store.connection_method === 'oauth' ? ' via OAuth' : ''}. One-click push is coming soon.
                  </Alert>
                ) : (
                  <p className="small text-muted mb-3">
                    Connect your store URL first, then follow the guided setup on Store Overview.
                  </p>
                )}
                <Link to="/store#guided-api-setup">
                  <Button variant="outline-primary" size="sm">
                    Open guided setup
                  </Button>
                </Link>
              </Card.Body>
            </Card>
          </Col>

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
        </Row>
      </Card.Body>
    </Card>
  );
}
