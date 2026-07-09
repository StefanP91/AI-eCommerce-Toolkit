import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Nav,
  Row,
  Spinner,
} from 'react-bootstrap';
import api from '../../api/client';
import { STORE_API_GUIDES } from '../../constants/storePublish';

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
  const [platform, setPlatform] = useState(store?.platform || 'shopify');
  const [form, setForm] = useState({
    admin_access_token: '',
    consumer_key: '',
    consumer_secret: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const guide = STORE_API_GUIDES[platform];

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
        platform,
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
            <h5 className="mb-1">Guided API setup</h5>
            <p className="text-muted small mb-0">
              Level 2 — follow the steps below to prepare one-click publishing later.
            </p>
          </div>
          <Badge bg="warning" text="dark">Level 2</Badge>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}

        {store?.has_api_connection ? (
          <Alert variant="success" className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span>
              API connected for <strong>{store.platform}</strong>
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
        ) : (
          <>
            <Nav variant="pills" className="mb-3 gap-2">
              {Object.values(STORE_API_GUIDES).map((item) => (
                <Nav.Item key={item.id}>
                  <Nav.Link
                    active={platform === item.id}
                    onClick={() => setPlatform(item.id)}
                    className="px-3"
                  >
                    {item.label}
                  </Nav.Link>
                </Nav.Item>
              ))}
            </Nav>

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
        )}

        <Card className="border bg-light mt-4">
          <Card.Body className="py-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <strong>Level 3: Connect with Shopify</strong>
                <div className="small text-muted">One-click OAuth sign-in — no manual API keys.</div>
              </div>
              <Button variant="secondary" size="sm" disabled>
                Coming soon
              </Button>
            </div>
          </Card.Body>
        </Card>
      </Card.Body>
    </Card>
  );
}
