import { useState, useRef } from 'react';
import { Row, Col, Card, Form, Button, Alert, Spinner, Badge } from 'react-bootstrap';
import api from '../api/client';
import { notifyCreditsUpdated } from '../utils/credits';

const SIZE_COLORS = { excellent: 'success', good: 'primary', fair: 'warning', poor: 'danger' };

function downloadOptimizedImage(result) {
  const bytes = atob(result.optimized_image_base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: result.optimized_mime || 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.optimized_filename || 'optimized-image.jpg';
  link.click();
  URL.revokeObjectURL(url);
}

export default function ImageOptimizer() {
  const fileRef = useRef(null);
  const [inputType, setInputType] = useState('upload');
  const [form, setForm] = useState({ product_name: '', image_url: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('product_name', form.product_name);

    if (inputType === 'upload') {
      const file = fileRef.current?.files?.[0];
      if (!file) {
        setError('Please select an image.');
        setLoading(false);
        return;
      }
      formData.append('image', file);
    } else {
      formData.append('image_url', form.image_url);
    }

    try {
      const res = await api.post('/tools/image-optimize', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      setRemaining(res.data.generations_remaining);
      notifyCreditsUpdated();
    } catch (err) {
      setError(err.response?.data?.message || 'Image optimization failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">Image Optimizer</h3>
        <p className="text-muted mb-0">
          Compress & resize product images for web, plus AI alt text and SEO filename suggestions.
          {remaining !== null && (
            <span className="ms-2 badge bg-secondary">{remaining} remaining today</span>
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
                    onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                    placeholder="e.g. Wireless Gaming Mouse"
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <div className="d-flex gap-2 mb-2">
                    <Button variant={inputType === 'upload' ? 'primary' : 'outline-secondary'} size="sm" type="button" onClick={() => setInputType('upload')}>Upload</Button>
                    <Button variant={inputType === 'url' ? 'primary' : 'outline-secondary'} size="sm" type="button" onClick={() => setInputType('url')}>Image URL</Button>
                  </div>
                  {inputType === 'upload' ? (
                    <Form.Control type="file" accept="image/*" ref={fileRef} required />
                  ) : (
                    <Form.Control
                      type="url"
                      name="image_url"
                      value={form.image_url}
                      onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                      placeholder="https://..."
                      required
                    />
                  )}
                </Form.Group>

                <Button type="submit" className="w-100" disabled={loading}>
                  {loading ? <><Spinner size="sm" className="me-2" />Optimizing...</> : '🖼️ Optimize Image'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {result && (
          <Col lg={7}>
            {!result.compression_available && (
              <Alert variant="warning" className="py-2">
                Server compression is unavailable (PHP GD extension). Only SEO suggestions were generated — enable <code>extension=gd</code> in php.ini and restart the backend.
              </Alert>
            )}
            <Alert variant={result.savings_percent > 0 ? 'success' : 'info'} className="py-2">
              {result.savings_percent > 0 ? (
                <>Compressed <strong>{result.file_size_kb} KB</strong> → <strong>{result.optimized_size_kb} KB</strong> ({result.savings_percent}% smaller)</>
              ) : (
                <>Image is already web-optimized at <strong>{result.file_size_kb} KB</strong></>
              )}
              {result.was_resized && result.dimensions && (
                <span className="ms-2">· Resized to {result.dimensions}</span>
              )}
            </Alert>

            <div className="mb-3">
              <Button variant="primary" onClick={() => downloadOptimizedImage(result)}>
                ↓ Download Optimized Image
              </Button>
            </div>

            <Card className="border-0 shadow-sm mb-3">
              <Card.Header className="bg-white fw-semibold">Before / After</Card.Header>
              <Card.Body className="d-flex gap-3 flex-wrap">
                <div>
                  <small className="text-muted d-block">Original</small>
                  <strong>{result.file_size_kb} KB</strong>
                  <Badge bg={SIZE_COLORS[result.size_rating] || 'secondary'} className="ms-2">{result.size_rating}</Badge>
                </div>
                <div>
                  <small className="text-muted d-block">Optimized</small>
                  <strong>{result.optimized_size_kb} KB</strong>
                  <span className="text-muted small ms-1">({result.optimized_mime})</span>
                </div>
                <div>
                  <small className="text-muted d-block">Filename</small>
                  <code>{result.optimized_filename}</code>
                </div>
              </Card.Body>
            </Card>

            <Card className="border-0 shadow-sm mb-3">
              <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                <span className="fw-semibold">Suggested Alt Text</span>
                <Button variant="outline-secondary" size="sm" onClick={async () => {
                  await navigator.clipboard.writeText(result.alt_text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}>{copied ? 'Copied!' : 'Copy'}</Button>
              </Card.Header>
              <Card.Body><p className="mb-0">{result.alt_text}</p></Card.Body>
            </Card>

            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white fw-semibold">SEO Tips</Card.Header>
              <Card.Body>
                <ul className="mb-0 ps-3">
                  {result.seo_tips?.map((tip, i) => <li key={i} className="mb-2">{tip}</li>)}
                </ul>
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
