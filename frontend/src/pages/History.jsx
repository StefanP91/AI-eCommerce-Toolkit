import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Table, Badge, Button, Spinner, Form } from 'react-bootstrap';
import api from '../api/client';

const TYPE_LABELS = {
  product_generator: { label: 'Product', variant: 'primary' },
  bulk_upload: { label: 'Bulk', variant: 'success' },
  seo_audit: { label: 'SEO Audit', variant: 'warning' },
  title_generator: { label: 'Title', variant: 'info' },
  meta_generator: { label: 'Meta', variant: 'secondary' },
  translator: { label: 'Translate', variant: 'dark' },
  schema_generator: { label: 'Schema', variant: 'secondary' },
  image_optimizer: { label: 'Image', variant: 'info' },
};

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({});

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page });
    if (filter) params.set('type', filter);

    api.get(`/history?${params}`)
      .then((res) => {
        setItems(res.data.data || []);
        setMeta({
          current: res.data.current_page,
          last: res.data.last_page,
          total: res.data.total,
        });
      })
      .finally(() => setLoading(false));
  }, [page, filter]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h3 className="mb-1">AI History</h3>
          <p className="text-muted mb-0">All your AI generation requests ({meta.total || 0})</p>
        </div>
        <Form.Select
          style={{ width: 220 }}
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1); }}
        >
          <option value="">All types</option>
          <option value="product_generator">Product Generator</option>
          <option value="bulk_upload">Bulk Upload</option>
          <option value="seo_audit">SEO Audit</option>
          <option value="title_generator">Title Generator</option>
          <option value="meta_generator">Meta Generator</option>
          <option value="translator">Translator</option>
          <option value="schema_generator">Schema Generator</option>
          <option value="image_optimizer">Image Optimizer</option>
        </Form.Select>
      </div>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-5 text-muted">No history yet.</div>
          ) : (
            <Table hover responsive className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Type</th>
                  <th>Input</th>
                  <th>SEO Score</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const typeInfo = TYPE_LABELS[item.type] || { label: item.type, variant: 'secondary' };
                  return (
                    <tr key={item.id}>
                      <td>
                        <Badge bg={typeInfo.variant}>{typeInfo.label}</Badge>
                      </td>
                      <td className="text-truncate" style={{ maxWidth: 300 }}>
                        {item.input_summary}
                      </td>
                      <td>
                        {item.seo_score != null ? (
                          <Badge bg={item.seo_score >= 80 ? 'success' : 'warning'}>
                            {item.seo_score}/100
                          </Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-muted small">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="text-end">
                        <Link to={`/history/${item.id}`}>
                          <Button variant="outline-primary" size="sm" className="me-1">View</Button>
                        </Link>
                        {item.type === 'title_generator' && item.result_data?.titles && (
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(item.result_data.titles.join('\n'))}
                          >
                            Copy
                          </Button>
                        )}
                        {item.type === 'meta_generator' && item.result_data?.meta_description && (
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(item.result_data.meta_description)}
                          >
                            Copy
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {meta.last > 1 && (
        <div className="d-flex justify-content-center gap-2 mt-3">
          <Button variant="outline-secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="align-self-center small text-muted">Page {meta.current} of {meta.last}</span>
          <Button variant="outline-secondary" size="sm" disabled={page >= meta.last} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
