import { useState } from 'react';
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
} from 'react-bootstrap';
import api from '../../api/client';
import { STORE_API_GUIDES } from '../../constants/storePublish';
import { getStorePlatform } from '../../constants/storePlatforms';
import StorePlatformLogo from './StorePlatformLogo';
import ShopifyConnectButton from './ShopifyConnectButton';

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

function SecretInput({ name, label, value, onChange, placeholder }) {
  const [visible, setVisible] = useState(false);

  return (
    <Form.Group className="mb-3">
      <Form.Label>{label}</Form.Label>
      <InputGroup>
        <Form.Control
          type={visible ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="off"
        />
        <Button
          variant="outline-secondary"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide value' : 'Show value'}
        >
          <EyeIcon slashed={visible} />
        </Button>
      </InputGroup>
    </Form.Group>
  );
}

export default function StoreApiSetup({ store, onUpdated }) {
  const storePlatform = store?.platform || 'shopify';
  const [form, setForm] = useState({
    admin_access_token: '',
    consumer_key: '',
    consumer_secret: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const guide = STORE_API_GUIDES[storePlatform];
  const connectedPlatform = getStorePlatform(storePlatform);
  const hasApiGuide = Boolean(STORE_API_GUIDES[storePlatform]);

  const handleChange = (e) => {
    setForm((current) => ({ ...current, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const res = await api.post('/store/api', {
        platform: storePlatform,
        ...form,
      });
      setMessage(res.data.message);
      onUpdated?.(res.data.store);
      setForm({
        admin_access_token: '',
        consumer_key: '',
        consumer_secret: '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not connect store API.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError('');
    setMessage('');

    try {
      const res = await api.delete('/store/api');
      setMessage(res.data.message);
      onUpdated?.(res.data.store);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not disconnect store API.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm mb-4" id="guided-api-setup">
      <Card.Body className="p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h5 className="mb-1">Guided setup</h5>
            <p className="text-muted small mb-0">
              {connectedPlatform
                ? `Connect ${connectedPlatform.label} for publishing and one-click workflows where available.`
                : 'Level 2 — follow the steps below to prepare one-click publishing later.'}
            </p>
          </div>
          {connectedPlatform && (
            <div className="d-flex align-items-center gap-2">
              <StorePlatformLogo platformId={connectedPlatform.id} size={28} />
              <Badge bg="light" text="dark">{connectedPlatform.label}</Badge>
            </div>
          )}
        </div>

        {error && <Alert variant="danger">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}

        {store?.has_api_connection ? (
          <Alert variant="success" className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span>
              API connected for <strong>{store.platform}</strong>
              {store.connection_method === 'oauth' && ' via OAuth'}
              {store.api_connected_at && (
                <span className="text-muted">
                  {' '}· since {new Date(store.api_connected_at).toLocaleString()}
                </span>
              )}
            </span>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? 'Removing...' : 'Remove API connection'}
            </Button>
          </Alert>
        ) : hasApiGuide && guide ? (
          <>
            <Row className="g-4">
              <Col lg={7}>
                <Card className="border h-100">
                  <Card.Body>
                    <h6 className="mb-2">Step-by-step</h6>
                    <p className="text-muted small">{guide.summary}</p>
                    <ol className="small ps-3 mb-3">
                      {guide.steps.map((step) => (
                        <li key={step} className="mb-2">{step}</li>
                      ))}
                    </ol>
                    <a href={guide.docsUrl} target="_blank" rel="noreferrer" className="small">
                      Open official {guide.label} documentation →
                    </a>
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={5}>
                <Card className="border h-100">
                  <Card.Body>
                    <h6 className="mb-3">Paste your credentials</h6>
                    <Form onSubmit={handleSubmit}>
                      {guide.fields.map((field) => (
                        <SecretInput
                          key={field.name}
                          name={field.name}
                          label={field.label}
                          value={form[field.name]}
                          onChange={handleChange}
                          placeholder={field.placeholder}
                        />
                      ))}
                      <Button type="submit" variant="primary" disabled={submitting}>
                        {submitting ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Verifying...
                          </>
                        ) : (
                          'Save API connection'
                        )}
                      </Button>
                    </Form>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        ) : connectedPlatform ? (
          <Card className="border">
            <Card.Body>
              <h6 className="mb-2">Publish to {connectedPlatform.label}</h6>
              <p className="text-muted small">
                One-click API push is not available for {connectedPlatform.label} yet.
                Scan and optimize here, then update products in your store admin.
              </p>
              <ol className="small ps-3 mb-3">
                {connectedPlatform.publishSteps.map((step) => (
                  <li key={step} className="mb-2">{step}</li>
                ))}
              </ol>
              <a href={connectedPlatform.docsUrl} target="_blank" rel="noreferrer" className="small">
                Open {connectedPlatform.label} documentation →
              </a>
            </Card.Body>
          </Card>
        ) : null}

        {storePlatform === 'shopify' && (
        <Card className="border bg-light mt-4">
          <Card.Body className="py-3">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <Badge bg="secondary">Level 3</Badge>
                  <strong>Connect with Shopify</strong>
                </div>
                <div className="small text-muted">
                  One-click OAuth sign-in — no manual API keys.
                </div>
              </div>
            </div>
            <div className="mt-3" style={{ maxWidth: 420 }}>
              <ShopifyConnectButton
                store={store}
                defaultShop={
                  store?.store_url?.includes('myshopify.com')
                    ? store.store_url.replace(/^https?:\/\//, '').split('/')[0]
                    : ''
                }
                onConnected={onUpdated}
              />
            </div>
          </Card.Body>
        </Card>
        )}
      </Card.Body>
    </Card>
  );
}
