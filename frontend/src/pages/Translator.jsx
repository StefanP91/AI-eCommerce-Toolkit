import { useEffect, useState } from 'react';
import { Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import api from '../api/client';
import { LANGUAGES } from '../constants/formOptions';
import { notifyCreditsUpdated } from '../utils/credits';

const FIELD_LABELS = {
  seo_title: 'SEO Title',
  description: 'Description',
  short_description: 'Short Description',
  meta_title: 'Meta Title',
  meta_description: 'Meta Description',
  image_alt_text: 'Image Alt Text',
};

export default function Translator() {
  const [projects, setProjects] = useState([]);
  const [source, setSource] = useState('manual');
  const [form, setForm] = useState({
    product_id: '',
    product_name: '',
    source_language: 'en',
    target_language: 'de',
    seo_title: '',
    description: '',
    short_description: '',
    meta_title: '',
    meta_description: '',
    image_alt_text: '',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(null);

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
      ? {
          product_id: Number(form.product_id),
          source_language: form.source_language,
          target_language: form.target_language,
        }
      : {
          product_name: form.product_name,
          source_language: form.source_language,
          target_language: form.target_language,
          seo_title: form.seo_title,
          description: form.description,
          short_description: form.short_description,
          meta_title: form.meta_title,
          meta_description: form.meta_description,
          image_alt_text: form.image_alt_text,
        };

    try {
      const res = await api.post('/tools/translate', payload);
      setResult(res.data);
      setRemaining(res.data.generations_remaining);
      notifyCreditsUpdated();
    } catch (err) {
      setError(err.response?.data?.message || 'Translation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">Translator</h3>
        <p className="text-muted mb-0">
          Translate product content to another language while keeping SEO structure.
          <span className="ms-1 small">Fill product name or content fields — at least one is required.</span>
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
                  <Form.Label className="fw-semibold">Source</Form.Label>
                  <div className="d-flex gap-2">
                    <Button variant={source === 'manual' ? 'primary' : 'outline-secondary'} size="sm" type="button" onClick={() => setSource('manual')}>Manual</Button>
                    <Button variant={source === 'project' ? 'primary' : 'outline-secondary'} size="sm" type="button" onClick={() => setSource('project')}>Saved Project</Button>
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
                    {['seo_title', 'description', 'short_description', 'meta_title', 'meta_description', 'image_alt_text'].map((field) => (
                      <Form.Group key={field} className="mb-2">
                        <Form.Label className="small">{FIELD_LABELS[field]}</Form.Label>
                        <Form.Control
                          as={field === 'description' ? 'textarea' : 'input'}
                          rows={field === 'description' ? 3 : undefined}
                          name={field}
                          value={form[field]}
                          onChange={handleChange}
                        />
                      </Form.Group>
                    ))}
                  </>
                )}

                <Row>
                  <Col>
                    <Form.Group className="mb-3">
                      <Form.Label>From</Form.Label>
                      <Form.Select name="source_language" value={form.source_language} onChange={handleChange}>
                        {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group className="mb-3">
                      <Form.Label>To</Form.Label>
                      <Form.Select name="target_language" value={form.target_language} onChange={handleChange}>
                        {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Button type="submit" className="w-100" disabled={loading}>
                  {loading ? <><Spinner size="sm" className="me-2" />Translating...</> : '🌐 Translate'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {result?.translated && Object.keys(result.translated).length > 0 && (
          <Col lg={7}>
            {result.demo_mode && (
              <Alert variant="warning" className="py-2 mb-3">
                <strong>Примерен превод (Demo)</strong>
                <div className="small mt-1">
                  {result.demo_reason === 'missing_api_key' ? (
                    <>Нема AI API клуч. Додај <code>GEMINI_API_KEY</code> во backend <code>.env</code>.</>
                  ) : result.demo_reason === 'insufficient_quota' ? (
                    <>AI квотата е потрошена. Провери billing на твојот AI провајдер.</>
                  ) : (
                    <>{result.demo_message || 'OpenAI не е достапен — прикажан е примерен превод.'}</>
                  )}
                </div>
              </Alert>
            )}
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white fw-semibold">
                <span>Translated ({result.source_language} → {result.target_language})</span>
              </Card.Header>
              <Card.Body>
                {Object.entries(result.translated).map(([key, value]) => (
                  <div key={key} className="mb-3 pb-3 border-bottom">
                    <div className="d-flex justify-content-between align-items-start">
                      <strong className="small text-muted">{FIELD_LABELS[key] || key}</strong>
                      <Button variant="outline-secondary" size="sm" onClick={() => navigator.clipboard.writeText(value)}>Copy</Button>
                    </div>
                    <p className="mb-0 mt-1" style={{ whiteSpace: 'pre-wrap' }}>{value}</p>
                  </div>
                ))}
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
