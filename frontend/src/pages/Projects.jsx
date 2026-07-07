import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Table, Badge, Button, Spinner, Dropdown } from 'react-bootstrap';
import api from '../api/client';
import { downloadAllProjects } from '../utils/download';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({});

  const loadProjects = (p = 1) => {
    setLoading(true);
    api.get(`/products?page=${p}`)
      .then((res) => {
        setProjects(res.data.data || []);
        setMeta({
          current: res.data.current_page,
          last: res.data.last_page,
          total: res.data.total,
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects(page);
  }, [page]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this project?')) return;
    await api.delete(`/products/${id}`);
    loadProjects(page);
  };

  const scoreBadge = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'danger';
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">Saved Projects</h3>
          <p className="text-muted mb-0">Products you saved from the generator ({meta.total || 0})</p>
        </div>
        <Dropdown>
          <Dropdown.Toggle variant="outline-primary" size="sm">Export All</Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => downloadAllProjects('csv')}>CSV</Dropdown.Item>
            <Dropdown.Item onClick={() => downloadAllProjects('excel')}>Excel</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
          ) : projects.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <p>No saved projects yet.</p>
              <p className="small">Generate content in AI Generator, then click <strong>Save Project</strong>.</p>
              <Link to="/generator"><Button variant="primary" size="sm">Generate First Product</Button></Link>
            </div>
          ) : (
            <Table hover responsive className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Product</th>
                  <th>SEO Score</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/projects/${p.id}`} className="text-decoration-none fw-semibold">
                        {p.product_name || `Project #${p.id}`}
                      </Link>
                    </td>
                    <td>
                      <Badge bg={scoreBadge(p.seo_score)}>{p.seo_score}/100</Badge>
                    </td>
                    <td className="text-muted">{p.category || '—'}</td>
                    <td className="text-muted small">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-end">
                      <Button variant="outline-danger" size="sm" onClick={() => handleDelete(p.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
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
