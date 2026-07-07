import { useState } from 'react';
import { Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import api from '../api/client';
import SeoScore from '../components/SeoScore';
import ProductResults from '../components/ProductResults';
import { notifyCreditsUpdated } from '../utils/credits';

const GENERATE_DEFAULTS = {
  language: 'en',
  tone: 'professional',
  target_country: 'US',
  category: 'General',
};

export default function SeoAudit() {
  const [auditType, setAuditType] = useState('url');
  const [form, setForm] = useState({
    product_url: '',
    product_name: '',
    page_title: '',
    meta_description: '',
    h1: '',
    description: '',
    image_alt_text: '',
  });
  const [result, setResult] = useState(null);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remaining, setRemaining] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setResult(null);
    setGeneratedResult(null);

    try {
      const res = await api.post('/tools/seo-audit', {
        audit_type: auditType,
        ...form,
      });
      setResult(res.data);
      setRemaining(res.data.generations_remaining);
      notifyCreditsUpdated();
    } catch (err) {
      setError(err.response?.data?.message || 'Audit failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const buildGeneratePayload = () => {
    const extracted = result?.extracted;

    if (auditType === 'url') {
      return {
        input_type: 'url',
        product_url: extracted?.url || form.product_url,
        ...GENERATE_DEFAULTS,
      };
    }

    const manualInfo = [
      form.product_name && `Product: ${form.product_name}`,
      form.page_title && `Current page title: ${form.page_title}`,
      form.meta_description && `Current meta description: ${form.meta_description}`,
      form.h1 && `Current H1: ${form.h1}`,
      form.description && `Current description: ${form.description}`,
      form.image_alt_text && `Current image alt: ${form.image_alt_text}`,
      'Generate improved SEO-optimized product content that fixes all issues found in the audit.',
    ].filter(Boolean).join('\n');

    return {
      input_type: 'manual',
      product_name: form.product_name || extracted?.product_name || '',
      manual_info: manualInfo,
      ...GENERATE_DEFAULTS,
    };
  };

  const handleFix = async () => {
    setError('');
    setFixing(true);
    setGeneratedResult(null);

    try {
      const res = await api.post('/products/generate', buildGeneratePayload());
      setGeneratedResult(res.data);
      setRemaining(res.data.generations_remaining);
      notifyCreditsUpdated();
    } catch (err) {
      setError(
        err.response?.data?.message
        || err.response?.data?.errors
        || 'AI generation failed. Please try again.'
      );
    } finally {
      setFixing(false);
    }
  };

  const handleSave = async () => {
    if (!generatedResult || generatedResult.product?.id) return;

    setError('');
    setSaving(true);

    try {
      const res = await api.post('/products', {
        ...generatedResult.input,
        generated_content: generatedResult.content,
        seo_score: generatedResult.seo_score,
        seo_checks: generatedResult.seo_checks,
        history_id: generatedResult.history_id,
      });
      setGeneratedResult((prev) => ({
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

  const extracted = result?.extracted;
  const canFix = result && (result.score < 100 || result.recommendations?.length > 0);

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">SEO Audit</h3>
        <p className="text-muted mb-0">
          Analyze any product page or existing content for SEO issues and get actionable recommendations.
          {remaining !== null && (
            <span className="ms-2 badge bg-secondary">{remaining} generations remaining today</span>
          )}
        </p>
      </div>

      <Row className="g-4">
        <Col lg={result ? 5 : 12}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="p-4">
              {error && <Alert variant="danger">{typeof error === 'string' ? error : JSON.stringify(error)}</Alert>}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-4">
                  <Form.Label className="fw-semibold">Audit Method</Form.Label>
                  <div className="d-flex gap-2 flex-wrap">
                    {[
                      { value: 'url', label: 'Product URL' },
                      { value: 'manual', label: 'Manual Content' },
                    ].map((opt) => (
                      <Button
                        key={opt.value}
                        variant={auditType === opt.value ? 'primary' : 'outline-secondary'}
                        size="sm"
                        type="button"
                        onClick={() => setAuditType(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </Form.Group>

                {auditType === 'url' ? (
                  <Form.Group className="mb-3">
                    <Form.Label>Product URL</Form.Label>
                    <Form.Control
                      type="url"
                      name="product_url"
                      value={form.product_url}
                      onChange={handleChange}
                      placeholder="https://yourstore.com/product/..."
                      required
                    />
                    <Form.Text className="text-muted">
                      We&apos;ll scan the page for title, meta, H1, schema, images, and more.
                    </Form.Text>
                  </Form.Group>
                ) : (
                  <>
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
                    <Form.Group className="mb-3">
                      <Form.Label>Page Title</Form.Label>
                      <Form.Control
                        name="page_title"
                        value={form.page_title}
                        onChange={handleChange}
                        placeholder="SEO page title (30-60 chars)"
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Meta Description</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        name="meta_description"
                        value={form.meta_description}
                        onChange={handleChange}
                        placeholder="120-160 characters"
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>H1 Heading</Form.Label>
                      <Form.Control
                        name="h1"
                        value={form.h1}
                        onChange={handleChange}
                        placeholder="Main heading on the page"
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Product Description</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        placeholder="Full product description"
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Image Alt Text</Form.Label>
                      <Form.Control
                        name="image_alt_text"
                        value={form.image_alt_text}
                        onChange={handleChange}
                        placeholder="Descriptive alt text for main product image"
                      />
                    </Form.Group>
                  </>
                )}

                <Button type="submit" variant="primary" className="w-100" disabled={loading || fixing}>
                  {loading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Running SEO Audit...
                    </>
                  ) : (
                    '🔍 Run SEO Audit'
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {result && (
          <Col lg={7}>
            <div className="mb-2">
              <small className="text-muted text-uppercase fw-semibold">Current Page Audit</small>
            </div>
            <SeoScore score={result.score} checks={result.checks} />

            {canFix && !generatedResult && (
              <Card className="border-0 shadow-sm mb-4 border-start border-4 border-primary">
                <Card.Body className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                  <div>
                    <h6 className="mb-1">Fix SEO issues with AI</h6>
                    <p className="text-muted small mb-0">
                      Generate optimized content based on this audit — no need to leave this page.
                    </p>
                  </div>
                  <Button variant="primary" onClick={handleFix} disabled={fixing}>
                    {fixing ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Generating...
                      </>
                    ) : (
                      '✨ Fix with AI'
                    )}
                  </Button>
                </Card.Body>
              </Card>
            )}

            {result.recommendations?.length > 0 && !generatedResult && (
              <Card className="border-0 shadow-sm mb-4">
                <Card.Header className="bg-white fw-semibold">Recommendations</Card.Header>
                <Card.Body>
                  <ul className="mb-0 ps-3">
                    {result.recommendations.map((tip, i) => (
                      <li key={i} className="mb-2">{tip}</li>
                    ))}
                  </ul>
                </Card.Body>
              </Card>
            )}

            {generatedResult && (
              <>
                {generatedResult.seo_score > result.score && (
                  <Alert variant="success" className="py-2">
                    SEO score improved from <strong>{result.score}</strong> to{' '}
                    <strong>{generatedResult.seo_score}</strong>/100
                  </Alert>
                )}
                <div className="mb-2">
                  <small className="text-muted text-uppercase fw-semibold">AI-Optimized Content</small>
                </div>
                <ProductResults
                  result={generatedResult}
                  onSave={handleSave}
                  saving={saving}
                />
              </>
            )}

            {extracted && auditType === 'url' && !generatedResult && (
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-white fw-semibold">Extracted Page Data</Card.Header>
                <Card.Body>
                  <dl className="mb-0 small">
                    {[
                      ['Product', extracted.product_name],
                      ['Page Title', extracted.page_title],
                      ['Meta Description', extracted.meta_description],
                      ['H1', extracted.h1],
                      ['Description', extracted.description?.slice(0, 200) + (extracted.description?.length > 200 ? '...' : '')],
                      ['Images', `${extracted.images_with_alt}/${extracted.images_total} with alt text`],
                      ['Schema', extracted.has_product_schema ? 'Product JSON-LD found' : 'Not found'],
                    ].map(([label, value]) => (
                      <div key={label} className="mb-2">
                        <dt className="text-muted">{label}</dt>
                        <dd className="mb-0">{value || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </Card.Body>
              </Card>
            )}
          </Col>
        )}
      </Row>
    </div>
  );
}
