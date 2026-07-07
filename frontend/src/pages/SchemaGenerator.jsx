import { useEffect, useState } from 'react';
import { Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import api from '../api/client';

export default function SchemaGenerator() {
  const [projects, setProjects] = useState([]);
  const [source, setSource] = useState('project');
  const [form, setForm] = useState({
    product_id: '',
    product_name: '',
    description: '',
    product_url: '',
    image_url: '',
    sku: '',
    brand: '',
    price: '',
    currency: 'USD',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get('/products?per_page=100').then((res) => setProjects(res.data.data || []));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setResult(null);

    const payload = source === 'project'
      ? { product_id: Number(form.product_id), product_url: form.product_url || undefined, image_url: form.image_url || undefined, sku: form.sku || undefined, brand: form.brand || undefined, price: form.price || undefined, currency: form.currency }
      : { ...form, price: form.price || undefined };

    try {
      const res = await api.post('/tools/schema', payload);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Schema generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.json_ld);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([result.json_ld], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-schema.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">Schema Generator</h3>
        <p className="text-muted mb-0">Generate JSON-LD Product schema markup for Google rich results. Free — no AI credits used.</p>
      </div>

      <Row className="g-4">
        <Col lg={result ? 5 : 12}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="p-4">
              {error && <Alert variant="danger">{error}</Alert>}
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <div className="d-flex gap-2">
                    <Button variant={source === 'project' ? 'primary' : 'outline-secondary'} size="sm" type="button" onClick={() => setSource('project')}>Saved Project</Button>
                    <Button variant={source === 'manual' ? 'primary' : 'outline-secondary'} size="sm" type="button" onClick={() => setSource('manual')}>Manual</Button>
                  </div>
                </Form.Group>

                {source === 'project' ? (
                  <Form.Group className="mb-3">
                    <Form.Label>Saved Project</Form.Label>
                    <Form.Select name="product_id" value={form.product_id} onChange={handleChange} required>
                      <option value="">Select project...</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.product_name || `Project #${p.id}`}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                ) : (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label>Product Name</Form.Label>
                      <Form.Control name="product_name" value={form.product_name} onChange={handleChange} required />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Description</Form.Label>
                      <Form.Control as="textarea" rows={3} name="description" value={form.description} onChange={handleChange} />
                    </Form.Group>
                  </>
                )}

                <Form.Group className="mb-2">
                  <Form.Label className="small">Product URL</Form.Label>
                  <Form.Control name="product_url" value={form.product_url} onChange={handleChange} placeholder="https://..." />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label className="small">Image URL</Form.Label>
                  <Form.Control name="image_url" value={form.image_url} onChange={handleChange} placeholder="https://..." />
                </Form.Group>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-2">
                      <Form.Label className="small">Brand</Form.Label>
                      <Form.Control name="brand" value={form.brand} onChange={handleChange} />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-2">
                      <Form.Label className="small">SKU</Form.Label>
                      <Form.Control name="sku" value={form.sku} onChange={handleChange} />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-2">
                      <Form.Label className="small">Price</Form.Label>
                      <Form.Control type="number" step="0.01" name="price" value={form.price} onChange={handleChange} />
                    </Form.Group>
                  </Col>
                </Row>

                <Button type="submit" className="w-100 mt-3" disabled={loading}>
                  {loading ? <><Spinner size="sm" className="me-2" />Generating...</> : '{ } Generate Schema'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {result && (
          <Col lg={7}>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                <span className="fw-semibold">JSON-LD Product Schema</span>
                <div className="d-flex gap-2">
                  <Button variant="outline-secondary" size="sm" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</Button>
                  <Button variant="primary" size="sm" onClick={handleDownload}>Download</Button>
                </div>
              </Card.Header>
              <Card.Body>
                <pre className="bg-light p-3 rounded small mb-0" style={{ maxHeight: 500, overflow: 'auto' }}>
                  {result.json_ld}
                </pre>
                <p className="text-muted small mt-3 mb-0">
                  Paste this inside a <code>&lt;script type=&quot;application/ld+json&quot;&gt;</code> tag in your product page HTML.
                </p>
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
