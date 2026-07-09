import { useState } from 'react';
import { Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import api from '../api/client';
import ProductResults from '../components/ProductResults';
import { LANGUAGES, TONES, COUNTRIES, CATEGORIES } from '../constants/formOptions';
import { notifyCreditsUpdated } from '../utils/credits';

export default function Generator() {
  const [inputType, setInputType] = useState('name');
  const [form, setForm] = useState({
    product_name: '',
    product_url: '',
    manual_info: '',
    language: 'en',
    tone: 'professional',
    target_country: 'US',
    category: 'General',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remaining, setRemaining] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const res = await api.post('/products/generate', {
        input_type: inputType,
        ...form,
      });
      setResult(res.data);
      setRemaining(res.data.generations_remaining);
      notifyCreditsUpdated();
    } catch (err) {
      setError(
        err.response?.data?.message
        || err.response?.data?.errors
        || 'Generation failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result || result.product?.id) return;

    setError('');
    setSaving(true);

    try {
      const res = await api.post('/products', {
        ...result.input,
        generated_content: result.content,
        seo_score: result.seo_score,
        seo_checks: result.seo_checks,
        history_id: result.history_id,
      });
      setResult((prev) => ({
        ...prev,
        product: res.data.product,
        saved: true,
      }));
      notifyCreditsUpdated();
    } catch (err) {
      setError(
        err.response?.data?.message
        || err.response?.data?.errors
        || 'Failed to save project. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">AI Product Generator</h3>
        <p className="text-muted mb-0">
          Generate SEO-optimized product content for any URL or product name, then save the ones you want to keep.
          {remaining !== null && (
            <span className="ms-2 badge bg-secondary">{remaining} generations remaining today</span>
          )}
        </p>
      </div>

      <Row className="g-4">
        <Col lg={result ? 5 : 12}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="p-4">
              {error && (
                <Alert variant="danger">
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-4">
                  <Form.Label className="fw-semibold">Input Method</Form.Label>
                  <div className="d-flex gap-2 flex-wrap">
                    {[
                      { value: 'name', label: 'Product Name' },
                      { value: 'url', label: 'Product URL' },
                      { value: 'manual', label: 'Manual Info' },
                    ].map((opt) => (
                      <Button
                        key={opt.value}
                        variant={inputType === opt.value ? 'primary' : 'outline-secondary'}
                        size="sm"
                        type="button"
                        onClick={() => setInputType(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </Form.Group>

                {inputType === 'name' && (
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
                )}

                {inputType === 'url' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Product URL</Form.Label>
                    <Form.Control
                      type="url"
                      name="product_url"
                      value={form.product_url}
                      onChange={handleChange}
                      placeholder="https://example.com/product/..."
                      required
                    />
                  </Form.Group>
                )}

                {inputType === 'manual' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Product Information</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      name="manual_info"
                      value={form.manual_info}
                      onChange={handleChange}
                      placeholder="Describe your product: features, specs, target audience..."
                      required
                    />
                  </Form.Group>
                )}

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Language</Form.Label>
                      <Form.Select name="language" value={form.language} onChange={handleChange}>
                        {LANGUAGES.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Tone</Form.Label>
                      <Form.Select name="tone" value={form.tone} onChange={handleChange}>
                        {TONES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Target Country</Form.Label>
                      <Form.Select name="target_country" value={form.target_country} onChange={handleChange}>
                        {COUNTRIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Category</Form.Label>
                      <Form.Select name="category" value={form.category} onChange={handleChange}>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Button type="submit" variant="primary" className="w-100" disabled={loading}>
                  {loading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Generating with AI...
                    </>
                  ) : (
                    '✨ Generate Product Content'
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {result && (
          <Col lg={7}>
            <ProductResults result={result} onSave={handleSave} saving={saving} />
          </Col>
        )}
      </Row>
    </div>
  );
}
