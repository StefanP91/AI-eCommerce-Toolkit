import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Row, Col, Card, Table, Form, Badge, Spinner, Alert, InputGroup, Button,
} from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { notifyCreditsUpdated } from '../utils/credits';

const PLAN_OPTIONS = ['free', 'pro'];
const STATUS_OPTIONS = ['active', 'suspended'];
const ROLE_OPTIONS = ['user', 'admin'];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('mk-MK');
}

export default function Admin() {
  const { user, setUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const loadData = useCallback(async (pageNum = 1, query = '') => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users', { params: { page: pageNum, search: query || undefined } }),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.data);
      setMeta({
        currentPage: usersRes.data.current_page,
        lastPage: usersRes.data.last_page,
        total: usersRes.data.total,
      });
      const nextDrafts = {};
      usersRes.data.data.forEach((u) => {
        nextDrafts[u.id] = { plan: u.plan, status: u.status, role: u.role };
      });
      setDrafts(nextDrafts);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadData(page, search);
    }
  }, [user, page, loadData]);

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleDraftChange = (userId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value },
    }));
  };

  const handleSave = async (targetUser) => {
    setSavingId(targetUser.id);
    setMessage('');
    setError('');
    try {
      const payload = drafts[targetUser.id];
      const res = await api.patch(`/admin/users/${targetUser.id}`, payload);
      setMessage(res.data.message);
      if (targetUser.id === user.id && res.data.user) {
        setUser(res.data.user);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        notifyCreditsUpdated();
      }
      await loadData(meta.currentPage || 1, search);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user.');
    } finally {
      setSavingId(null);
    }
  };

  const hasChanges = (targetUser) => {
    const draft = drafts[targetUser.id];
    if (!draft) return false;
    return draft.plan !== targetUser.plan
      || draft.status !== targetUser.status
      || draft.role !== targetUser.role;
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadData(1, search);
  };

  if (loading && !stats) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">Admin Panel</h3>
        <p className="text-muted mb-0">Преглед на корисници и управување со статуси.</p>
      </div>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      {stats && (
        <Row className="g-3 mb-4">
          {[
            ['Вкупно корисници', stats.total_users],
            ['Активни', stats.active_users],
            ['Суспендирани', stats.suspended_users],
            ['Pro корисници', stats.pro_users],
            ['Производи', stats.total_products],
            ['AI генерации', stats.total_generations],
          ].map(([label, value]) => (
            <Col key={label} sm={6} lg={4} xl={2}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body className="py-3">
                  <small className="text-muted">{label}</small>
                  <h4 className="mb-0">{value}</h4>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span className="fw-semibold">Корисници ({meta.total ?? 0})</span>
          <Form onSubmit={handleSearch} className="d-flex gap-2" style={{ minWidth: 280 }}>
            <Form.Control
              size="sm"
              placeholder="Пребарај по име или email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit" size="sm" variant="outline-primary">Барај</Button>
          </Form>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th className="ps-3">Корисник</th>
                  <th>План</th>
                  <th>Статус</th>
                  <th>Улога</th>
                  <th>Производи</th>
                  <th>AI</th>
                  <th>Регистрација</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">Нема корисници.</td>
                  </tr>
                ) : users.map((u) => (
                  <tr key={u.id}>
                    <td className="ps-3">
                      <div className="fw-semibold">{u.name}</div>
                      <small className="text-muted">{u.email}</small>
                      {u.id === user.id && <Badge bg="info" className="ms-1">ти</Badge>}
                    </td>
                    <td>
                      <Form.Select
                        size="sm"
                        value={drafts[u.id]?.plan ?? u.plan}
                        onChange={(e) => handleDraftChange(u.id, 'plan', e.target.value)}
                      >
                        {PLAN_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </Form.Select>
                    </td>
                    <td>
                      <Form.Select
                        size="sm"
                        value={drafts[u.id]?.status ?? u.status}
                        onChange={(e) => handleDraftChange(u.id, 'status', e.target.value)}
                        disabled={u.id === user.id}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </Form.Select>
                    </td>
                    <td>
                      <Form.Select
                        size="sm"
                        value={drafts[u.id]?.role ?? u.role}
                        onChange={(e) => handleDraftChange(u.id, 'role', e.target.value)}
                        disabled={u.id === user.id}
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </Form.Select>
                    </td>
                    <td>{u.products_count}</td>
                    <td>{u.generation_histories_count}</td>
                    <td><small>{formatDate(u.created_at)}</small></td>
                    <td>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={!hasChanges(u) || savingId === u.id}
                        onClick={() => handleSave(u)}
                      >
                        {savingId === u.id ? '...' : 'Зачувај'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
        {meta.lastPage > 1 && (
          <Card.Footer className="bg-white d-flex justify-content-between align-items-center">
            <small className="text-muted">Страна {meta.currentPage} од {meta.lastPage}</small>
            <InputGroup size="sm" style={{ width: 'auto' }}>
              <Button
                variant="outline-secondary"
                disabled={meta.currentPage <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ←
              </Button>
              <Button
                variant="outline-secondary"
                disabled={meta.currentPage >= meta.lastPage}
                onClick={() => setPage((p) => p + 1)}
              >
                →
              </Button>
            </InputGroup>
          </Card.Footer>
        )}
      </Card>
    </div>
  );
}
