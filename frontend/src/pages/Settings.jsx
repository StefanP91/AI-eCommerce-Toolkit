import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Form, Button, Alert, ProgressBar, Badge } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { PLANS } from '../constants/plans';
import api from '../api/client';

export default function Settings() {
  const { user, setUser, refreshUser } = useAuth();
  const [credits, setCredits] = useState(null);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    current_password: '',
    password: '',
    password_confirmation: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const planKey = credits?.plan ?? user?.plan ?? 'free';
  const isPro = planKey === 'pro';
  const plan = PLANS[planKey] || PLANS.free;

  useEffect(() => {
    const loadAccount = async () => {
      try {
        const [creditsRes, freshUser] = await Promise.all([
          api.get('/credits'),
          refreshUser(),
        ]);
        setCredits(creditsRes.data);
        setForm((f) => ({
          ...f,
          name: freshUser.name,
          email: freshUser.email,
        }));
      } catch {
        api.get('/credits').then((res) => setCredits(res.data)).catch(() => {});
      }
    };
    loadAccount();
  }, [refreshUser]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const openPortal = async () => {
    setError('');
    setPortalLoading(true);
    try {
      const res = await api.post('/billing/portal');
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      setError('Billing portal is not available yet.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not open billing portal.');
    } finally {
      setPortalLoading(false);
    }
  };

  const startCheckout = async () => {
    setError('');
    setCheckoutLoading(true);
    try {
      const res = await api.post('/billing/checkout');
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      setError('Checkout URL was missing. Please try again.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start checkout.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const payload = { name: form.name, email: form.email };
    if (form.password) {
      payload.current_password = form.current_password;
      payload.password = form.password;
      payload.password_confirmation = form.password_confirmation;
    }

    try {
      const res = await api.put('/settings', payload);
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      setMessage('Settings updated successfully.');
      setForm((f) => ({ ...f, current_password: '', password: '', password_confirmation: '' }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const dailyPct = credits?.daily_limit
    ? Math.round((credits.generations_today / credits.daily_limit) * 100)
    : 0;
  const monthlyPct = credits?.monthly_product_limit
    ? Math.round((credits.products_this_month / credits.monthly_product_limit) * 100)
    : 0;

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">Settings</h3>
        <p className="text-muted mb-0">Manage your account and preferences.</p>
      </div>

      <div style={{ maxWidth: 600 }}>
        {message && <Alert variant="success">{message}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}

        <Card className="border-0 shadow-sm mb-4">
          <Card.Header className="bg-white d-flex justify-content-between align-items-center">
            <span className="fw-semibold">Your Plan</span>
            <Badge bg={isPro ? 'success' : 'secondary'} className="text-uppercase">
              {plan.name}
            </Badge>
          </Card.Header>
          <Card.Body>
            <p className="text-muted small mb-3">{plan.description}</p>

            {isPro ? (
              <>
                <Alert variant="success" className="mb-3 py-2">
                  You have unlimited AI generations and saved products.
                </Alert>
                <div className="d-flex flex-wrap gap-2">
                  <Button variant="outline-primary" size="sm" onClick={openPortal} disabled={portalLoading}>
                    {portalLoading ? 'Opening…' : 'Manage billing'}
                  </Button>
                  <Link to="/pricing">
                    <Button variant="outline-secondary" size="sm">View plans</Button>
                  </Link>
                </div>
              </>
            ) : credits && (
              <>
                <div className="mb-3">
                  <small className="text-muted d-block mb-1">AI Credits Today</small>
                  <div className="d-flex justify-content-between small mb-1">
                    <span>{credits.generations_today} / {credits.daily_limit}</span>
                    <span>{credits.generations_remaining} left</span>
                  </div>
                  <ProgressBar now={dailyPct} variant={dailyPct >= 90 ? 'danger' : 'primary'} style={{ height: 6 }} />
                </div>
                <div className="mb-3">
                  <small className="text-muted d-block mb-1">Products This Month</small>
                  <div className="d-flex justify-content-between small mb-1">
                    <span>{credits.products_this_month} / {credits.monthly_product_limit}</span>
                    <span>{credits.products_remaining} left</span>
                  </div>
                  <ProgressBar now={monthlyPct} variant={monthlyPct >= 90 ? 'warning' : 'info'} style={{ height: 6 }} />
                </div>
                <Button variant="primary" size="sm" onClick={startCheckout} disabled={checkoutLoading}>
                  {checkoutLoading ? 'Redirecting…' : 'Upgrade to Pro — $19/mo'}
                </Button>
              </>
            )}
          </Card.Body>
        </Card>

        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-white fw-semibold">Profile</Card.Header>
          <Card.Body>
            <Form onSubmit={handleProfileSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Name</Form.Label>
                <Form.Control name="name" value={form.name} onChange={handleChange} required />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" name="email" value={form.email} onChange={handleChange} required />
              </Form.Group>

              <hr />
              <p className="text-muted small">Leave blank to keep current password</p>

              <Form.Group className="mb-3">
                <Form.Label>Current Password</Form.Label>
                <Form.Control
                  type="password"
                  name="current_password"
                  value={form.current_password}
                  onChange={handleChange}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>New Password</Form.Label>
                <Form.Control type="password" name="password" value={form.password} onChange={handleChange} />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Confirm New Password</Form.Label>
                <Form.Control
                  type="password"
                  name="password_confirmation"
                  value={form.password_confirmation}
                  onChange={handleChange}
                />
              </Form.Group>

              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
