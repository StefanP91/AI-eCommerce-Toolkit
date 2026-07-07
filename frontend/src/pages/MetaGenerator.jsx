import { useState } from 'react';
import { Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import api from '../api/client';
import { LANGUAGES, TONES, COUNTRIES, CATEGORIES } from '../constants/formOptions';
import { notifyCreditsUpdated } from '../utils/credits';

export default function MetaGenerator() {
  const [form, setForm] = useState({
    product_name: '',
    language: 'en',
    tone: 'professional',
    target_country: 'US',
    category: 'General',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const res = await api.post('/tools/meta', form);
      setResult(res.data);
      setRemaining(res.data.generations_remaining);
      notifyCreditsUpdated();
    } catch (err) {
      setError(err.response?.data?.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.meta_description);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">AI Meta Generator</h3>
        <p className="text-muted mb-0">
          Generate SEO-optimized meta descriptions.
          {remaining !== null && (
            <span className="ms-2 badge bg-secondary">{remaining} generations remaining today</span>
          )}
        </p>
      </div>

      <Row className="g-4">
        <Col lg={result ? 5 : 12}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="p-4">
              {error && <Alert variant="danger">{error}</Alert>}
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Product Name</Form.Label>
                  <Form.Control
                    name="product_name"
                    value={form.product_name}
                    onChange={handleChange}
                    placeholder="e.g. Wireless Gaming Mouse"
                    required
                  />
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Language</Form.Label>
                      <Form.Select name="language" value={form.language} onChange={handleChange}>
                        {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Tone</Form.Label>
                      <Form.Select name="tone" value={form.tone} onChange={handleChange}>
                        {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Target Country</Form.Label>
                      <Form.Select name="target_country" value={form.target_country} onChange={handleChange}>
                        {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Category</Form.Label>
                      <Form.Select name="category" value={form.category} onChange={handleChange}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Button type="submit" variant="primary" className="w-100" disabled={loading}>
                  {loading ? <><Spinner animation="border" size="sm" className="me-2" />Generating...</> : 'Generate Meta Description'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {result && (
          <Col lg={7}>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white fw-semibold d-flex justify-content-between align-items-center">
                Meta Description
                <Button variant="outline-primary" size="sm" onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </Card.Header>
              <Card.Body>
                <p className="mb-2" style={{ whiteSpace: 'pre-wrap' }}>{result.meta_description}</p>
                <small className="text-muted">{result.meta_description.length} / 160 characters</small>
                <div className="mt-3 p-3 bg-light rounded">
                  <small className="text-muted d-block mb-1">Google preview:</small>
                  <div className="text-primary fw-semibold">{form.product_name} | Buy Online</div>
                  <div className="text-success small">www.yourstore.com › product</div>
                  <div className="small text-muted">{result.meta_description}</div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
