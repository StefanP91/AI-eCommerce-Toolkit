import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import api from '../api/client';
import SeoScore from '../components/SeoScore';
import ProductResults from '../components/ProductResults';
import { notifyCreditsUpdated } from '../utils/credits';

const TYPE_LABELS = {
  product_generator: 'Product Generator',
  bulk_upload: 'Bulk Upload',
  seo_audit: 'SEO Audit',
  title_generator: 'Title Generator',
  meta_generator: 'Meta Generator',
  translator: 'Translator',
  schema_generator: 'Schema Generator',
  image_optimizer: 'Image Optimizer',
};

export default function HistoryDetail() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    api.get(`/history/${id}`)
      .then((res) => setItem(res.data))
      .catch(() => setError('History entry not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await api.post(`/history/${id}/save-product`);
      setItem((prev) => ({ ...prev, product_id: res.data.product.id, product: res.data.product }));
      setSaveMsg('Project saved successfully!');
      notifyCreditsUpdated();
    } catch (err) {
      setSaveMsg(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }

  if (error || !item) {
    return <Alert variant="danger">{error || 'Not found.'}</Alert>;
  }

  const data = item.result_data || {};

  return (
    <div>
      <Link to="/history" className="small text-decoration-none">← Back to History</Link>
      <div className="d-flex justify-content-between align-items-start mb-4 mt-2 flex-wrap gap-2">
        <div>
          <h3 className="mb-1">{TYPE_LABELS[item.type] || item.type}</h3>
          <p className="text-muted mb-0">{item.input_summary}</p>
          <small className="text-muted">{new Date(item.created_at).toLocaleString()}</small>
        </div>
        {item.seo_score != null && (
          <Badge bg={item.seo_score >= 80 ? 'success' : 'warning'} className="fs-6">
            {item.seo_score}/100
          </Badge>
        )}
      </div>

      {saveMsg && <Alert variant={saveMsg.includes('success') ? 'success' : 'danger'}>{saveMsg}</Alert>}

      {item.type === 'product_generator' && data.content && (
        <>
          {!item.product_id && (
            <div className="mb-3">
              <Button variant="success" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : '💾 Save as Project'}
              </Button>
            </div>
          )}
          {item.product_id && (
            <Alert variant="success" className="py-2">
              Saved as project. <Link to={`/projects/${item.product_id}`}>View project →</Link>
            </Alert>
          )}
          <ProductResults
            result={{
              content: data.content,
              seo_score: data.seo_score,
              seo_checks: data.seo_checks,
              product: item.product,
            }}
          />
        </>
      )}

      {item.type === 'seo_audit' && (
        <>
          <SeoScore score={data.score} checks={data.checks} />
          {data.recommendations?.length > 0 && (
            <Card className="border-0 shadow-sm mt-3">
              <Card.Header className="bg-white fw-semibold">Recommendations</Card.Header>
              <Card.Body>
                <ul className="mb-0 ps-3">
                  {data.recommendations.map((tip, i) => <li key={i}>{tip}</li>)}
                </ul>
              </Card.Body>
            </Card>
          )}
        </>
      )}

      {item.type === 'title_generator' && data.titles && (
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <ol className="mb-0">
              {data.titles.map((t, i) => <li key={i} className="mb-2">{t}</li>)}
            </ol>
          </Card.Body>
        </Card>
      )}

      {item.type === 'meta_generator' && data.meta_description && (
        <Card className="border-0 shadow-sm">
          <Card.Body><p className="mb-0">{data.meta_description}</p></Card.Body>
        </Card>
      )}

      {item.type === 'translator' && data.translated && (
        <Card className="border-0 shadow-sm">
          <Card.Body>
            {Object.entries(data.translated).map(([key, val]) => (
              <div key={key} className="mb-3">
                <strong className="small text-muted text-uppercase">{key.replace(/_/g, ' ')}</strong>
                <p className="mb-0">{val}</p>
              </div>
            ))}
          </Card.Body>
        </Card>
      )}

      {item.type === 'schema_generator' && data.json_ld && (
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <pre className="bg-light p-3 rounded small mb-0">{data.json_ld}</pre>
          </Card.Body>
        </Card>
      )}

      {item.type === 'image_optimizer' && (
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <p><strong>Alt text:</strong> {data.alt_text}</p>
            <p><strong>Filename:</strong> <code>{data.optimized_filename || data.filename_suggestion}</code></p>
            <p><strong>Size:</strong> {data.file_size_kb} KB → {data.optimized_size_kb} KB ({data.savings_percent}% saved)</p>
            <ul>{data.seo_tips?.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </Card.Body>
        </Card>
      )}

      {item.product_id && item.type !== 'product_generator' && (
        <div className="mt-3">
          <Link to={`/projects/${item.product_id}`}>
            <Button variant="outline-primary" size="sm">View Saved Project</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
