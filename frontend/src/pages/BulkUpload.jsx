import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Card, Form, Button, Alert, Spinner, Table, Badge, ProgressBar,
} from 'react-bootstrap';
import api from '../api/client';
import { LANGUAGES, TONES, COUNTRIES, CATEGORIES } from '../constants/formOptions';
import { notifyCreditsUpdated } from '../utils/credits';

function statusBadge(status) {
  const map = {
    pending: 'secondary',
    processing: 'info',
    completed: 'success',
    failed: 'danger',
  };
  return map[status] || 'secondary';
}

export default function BulkUpload() {
  const fileRef = useRef(null);
  const [defaults, setDefaults] = useState({
    language: 'en',
    tone: 'professional',
    target_country: 'US',
    category: 'General',
  });
  const [bulkUpload, setBulkUpload] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  const handleDefaultChange = (e) => {
    setDefaults({ ...defaults, [e.target.name]: e.target.value });
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get('/bulk/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'bulk-upload-template.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Could not download template.');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setError('');

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Please select a CSV or Excel file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    Object.entries(defaults).forEach(([key, value]) => {
      formData.append(key, value);
    });

    setUploading(true);
    setBulkUpload(null);
    setItems([]);
    setDone(false);
    setLimitReached(false);

    try {
      const res = await api.post('/bulk/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBulkUpload(res.data.bulk_upload);
      setItems(res.data.items || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Check your file format.');
    } finally {
      setUploading(false);
    }
  };

  const handleProcessAll = async () => {
    if (!bulkUpload || processing) return;

    setProcessing(true);
    setError('');
    setDone(false);
    setLimitReached(false);

    let currentId = bulkUpload.id;
    let finished = false;

    while (!finished) {
      try {
        const res = await api.post(`/bulk/${currentId}/process-next`);
        setBulkUpload(res.data.bulk_upload);
        notifyCreditsUpdated();

        if (res.data.item) {
          setItems((prev) => prev.map((row) => (
            row.id === res.data.item.id ? res.data.item : row
          )));
        }

        finished = res.data.done;
        if (res.data.limit_reached) {
          setLimitReached(true);
          setError(res.data.message);
          break;
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Processing stopped due to an error.');
        break;
      }
    }

    setDone(true);
    setProcessing(false);
  };

  const progress = bulkUpload
    ? Math.round((bulkUpload.processed_rows / bulkUpload.total_rows) * 100)
    : 0;

  const pendingCount = items.filter((i) => i.status === 'pending').length;

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">Bulk Upload</h3>
        <p className="text-muted mb-0">
          Upload a CSV or Excel file with up to 100 products. Each row is generated and saved automatically.
        </p>
      </div>

      {error && <Alert variant={limitReached ? 'warning' : 'danger'}>{error}</Alert>}

      <div className="row g-4">
        <div className="col-lg-5">
          <Card className="border-0 shadow-sm">
            <Card.Body className="p-4">
              <Form onSubmit={handleUpload}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold">Upload File</Form.Label>
                  <Form.Control
                    type="file"
                    accept=".csv,.txt,.xls,.xml"
                    ref={fileRef}
                    required={!bulkUpload}
                  />
                  <Form.Text className="text-muted">
                    CSV or Excel (.xls). Max 100 rows per file.
                  </Form.Text>
                </Form.Group>

                <div className="mb-3">
                  <Button variant="link" className="p-0" type="button" onClick={downloadTemplate}>
                    ↓ Download CSV template
                  </Button>
                </div>

                <p className="small text-muted mb-2">Default settings for rows without values:</p>

                <RowDefaults defaults={defaults} onChange={handleDefaultChange} />

                <Button type="submit" variant="primary" className="w-100 mt-3" disabled={uploading}>
                  {uploading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Parsing file...
                    </>
                  ) : (
                    'Upload & Preview'
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </div>

        <div className="col-lg-7">
          {!bulkUpload ? (
            <Card className="border-0 shadow-sm h-100">
              <Card.Body className="d-flex align-items-center justify-content-center text-muted p-5">
                <div className="text-center">
                  <p className="mb-2">No file uploaded yet.</p>
                  <small>Upload a file to preview products before generating.</small>
                </div>
              </Card.Body>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-4">
                <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
                  <div>
                    <h5 className="mb-1">{bulkUpload.filename}</h5>
                    <small className="text-muted">
                      {bulkUpload.total_rows} products ·{' '}
                      <Badge bg={statusBadge(bulkUpload.status)}>{bulkUpload.status}</Badge>
                    </small>
                  </div>
                  {pendingCount > 0 && !processing && (
                    <Button variant="success" onClick={handleProcessAll}>
                      ▶ Generate All ({pendingCount})
                    </Button>
                  )}
                  {processing && (
                    <Button variant="success" disabled>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Processing...
                    </Button>
                  )}
                </div>

                {(processing || done) && (
                  <div className="mb-4">
                    <div className="d-flex justify-content-between small mb-1">
                      <span>{bulkUpload.processed_rows} / {bulkUpload.total_rows} processed</span>
                      <span>{bulkUpload.successful_rows} ok · {bulkUpload.failed_rows} failed</span>
                    </div>
                    <ProgressBar now={progress} variant={bulkUpload.failed_rows > 0 ? 'warning' : 'success'} />
                  </div>
                )}

                {done && !limitReached && (
                  <Alert variant="success" className="py-2">
                    Bulk upload complete!{' '}
                    <Link to="/projects">View saved projects →</Link>
                  </Alert>
                )}

                <Table responsive size="sm" className="mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th>Status</th>
                      <th>SEO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.row_number}</td>
                        <td className="text-truncate" style={{ maxWidth: 220 }}>
                          {item.product_name || item.product_url || item.manual_info?.slice(0, 40)}
                        </td>
                        <td>
                          <Badge bg={statusBadge(item.status)}>{item.status}</Badge>
                          {item.error_message && (
                            <small className="d-block text-danger">{item.error_message}</small>
                          )}
                        </td>
                        <td>
                          {item.product?.seo_score != null ? (
                            <Link to={`/projects/${item.product_id}`}>
                              <Badge bg={item.product.seo_score >= 80 ? 'success' : 'warning'}>
                                {item.product.seo_score}/100
                              </Badge>
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function RowDefaults({ defaults, onChange }) {
  return (
    <>
      <div className="row">
        <div className="col-6">
          <Form.Group className="mb-2">
            <Form.Label className="small">Language</Form.Label>
            <Form.Select size="sm" name="language" value={defaults.language} onChange={onChange}>
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </div>
        <div className="col-6">
          <Form.Group className="mb-2">
            <Form.Label className="small">Tone</Form.Label>
            <Form.Select size="sm" name="tone" value={defaults.tone} onChange={onChange}>
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </div>
      </div>
      <div className="row">
        <div className="col-6">
          <Form.Group className="mb-2">
            <Form.Label className="small">Target Country</Form.Label>
            <Form.Select size="sm" name="target_country" value={defaults.target_country} onChange={onChange}>
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </div>
        <div className="col-6">
          <Form.Group className="mb-2">
            <Form.Label className="small">Category</Form.Label>
            <Form.Select size="sm" name="category" value={defaults.category} onChange={onChange}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </div>
      </div>
    </>
  );
}
