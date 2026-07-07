import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Row, Col, Card, Spinner, Badge, Button } from 'react-bootstrap';
import api from '../api/client';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then((res) => setStats(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">Dashboard</h3>
          <p className="text-muted mb-0">Welcome back! Here&apos;s your overview.</p>
        </div>
        <Link to="/generator">
          <Button variant="primary">+ New Product</Button>
        </Link>
      </div>

      <Row className="g-4 mb-4">
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <small className="text-muted">Saved Projects</small>
              <h2 className="mb-0">{stats.total_products}</h2>
              <Link to="/projects" className="small">View all →</Link>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <small className="text-muted">AI Generations</small>
              <h2 className="mb-0">{stats.total_generations}</h2>
              <Link to="/history" className="small">View history →</Link>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <small className="text-muted">AI Credits Today</small>
              <h2 className="mb-0">
                {stats.generations_today}
                {stats.daily_limit && (
                  <small className="text-muted fs-6"> / {stats.daily_limit}</small>
                )}
              </h2>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <small className="text-muted">Products This Month</small>
              <h2 className="mb-0">
                {stats.products_this_month ?? 0}
                {stats.monthly_product_limit && (
                  <small className="text-muted fs-6"> / {stats.monthly_product_limit}</small>
                )}
              </h2>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {stats.plan !== 'pro' && stats.daily_limit && (
        <Card className="border-0 shadow-sm mb-4 pricing-banner">
          <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-3 py-3">
            <div>
              <h5 className="mb-1">Unlock unlimited AI with Pro</h5>
              <p className="text-muted mb-0 small">
                {stats.generations_today} of {stats.daily_limit} AI credits used today
                {stats.monthly_product_limit && (
                  <> · {stats.products_this_month ?? 0} of {stats.monthly_product_limit} products saved this month</>
                )}
              </p>
            </div>
            <Link to="/pricing">
              <Button variant="primary">View Plans — $19/mo</Button>
            </Link>
          </Card.Body>
        </Card>
      )}

      <Card className="border-0 shadow-sm mb-4">
        <Card.Header className="bg-white fw-semibold">Quick Tools</Card.Header>
        <Card.Body>
          <div className="d-flex flex-wrap gap-2">
            {[
              { to: '/generator', label: '✨ AI Generator' },
              { to: '/bulk-upload', label: '📤 Bulk Upload' },
              { to: '/seo-audit', label: '📋 SEO Audit' },
              { to: '/translator', label: '🌐 Translator' },
              { to: '/schema-generator', label: '{ } Schema' },
              { to: '/image-optimizer', label: '🖼️ Image Optimizer' },
              { to: '/title-generator', label: '📝 Titles' },
              { to: '/meta-generator', label: '🔍 Meta' },
            ].map((tool) => (
              <Link key={tool.to} to={tool.to}>
                <Button variant="outline-primary" size="sm">{tool.label}</Button>
              </Link>
            ))}
          </div>
        </Card.Body>
      </Card>

      <Row className="g-4">
        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white fw-semibold">Recent Products</Card.Header>
            <Card.Body>
              {stats.recent_products?.length === 0 ? (
                <p className="text-muted mb-0">No products yet. <Link to="/generator">Generate your first!</Link></p>
              ) : (
                stats.recent_products?.map((p) => (
                  <div key={p.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                    <Link to={`/projects/${p.id}`} className="text-decoration-none">
                      {p.product_name || `Product #${p.id}`}
                    </Link>
                    <Badge bg={p.seo_score >= 80 ? 'success' : p.seo_score >= 60 ? 'warning' : 'danger'}>
                      {p.seo_score}/100
                    </Badge>
                  </div>
                ))
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white fw-semibold">Recent History</Card.Header>
            <Card.Body>
              {stats.recent_history?.length === 0 ? (
                <p className="text-muted mb-0">No generation history yet.</p>
              ) : (
                stats.recent_history?.map((h) => (
                  <div key={h.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                    <Link to={`/history/${h.id}`} className="text-decoration-none text-truncate" style={{ maxWidth: '70%' }}>
                      {h.input_summary}
                    </Link>
                    <Badge bg="secondary">{h.seo_score != null ? `${h.seo_score}/100` : '—'}</Badge>
                  </div>
                ))
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
