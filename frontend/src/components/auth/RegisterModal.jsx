import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Modal, Form, Button, Alert, Badge } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { PLANS } from '../../constants/plans';
import BrandLogo from '../BrandLogo';

export default function RegisterModal({ show, onHide, onSwitchToLogin, initialPlan = 'free' }) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(initialPlan);
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show) {
      setPlan(initialPlan === 'pro' ? 'pro' : 'free');
    }
  }, [show, initialPlan]);

  const handleClose = () => {
    setError('');
    onHide();
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.password_confirmation, plan);
      handleClose();
      navigate(plan === 'pro' ? '/pricing' : '/dashboard');
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        setError(Object.values(errors).flat().join(' '));
      } else {
        setError(err.response?.data?.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered className="auth-modal" size="lg">
      <Modal.Header closeButton className="border-0 pb-0" />
      <Modal.Body className="px-4 pt-0 pb-4">
        <div className="text-center mb-4">
          <BrandLogo variant="light" className="brand-logo-auth mb-3" />
          <p className="text-muted mb-0">Start optimizing your products with AI</p>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-4">
            <Form.Label className="fw-semibold">Choose your plan</Form.Label>
            <div className="auth-plan-picker">
              {Object.values(PLANS).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`auth-plan-option${plan === item.id ? ' auth-plan-option-active' : ''}`}
                  onClick={() => setPlan(item.id)}
                >
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <strong>{item.name}</strong>
                    {item.popular && <Badge bg="primary">Popular</Badge>}
                  </div>
                  <div className="auth-plan-price mb-2">
                    {item.price === 0 ? '$0' : `$${item.price}`}
                    {item.price > 0 && <span className="text-muted"> / {item.period}</span>}
                  </div>
                  <p className="text-muted small mb-0">{item.description}</p>
                </button>
              ))}
            </div>
            {plan === 'pro' && (
              <Form.Text className="text-muted">
                Pro checkout is coming soon. Your account starts on Free until billing is enabled.
              </Form.Text>
            )}
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control name="name" value={form.name} onChange={handleChange} required />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control type="email" name="email" value={form.email} onChange={handleChange} required />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control type="password" name="password" value={form.password} onChange={handleChange} required />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Confirm Password</Form.Label>
            <Form.Control
              type="password"
              name="password_confirmation"
              value={form.password_confirmation}
              onChange={handleChange}
              required
            />
          </Form.Group>

          <Button type="submit" variant="primary" className="w-100" disabled={loading}>
            {loading ? 'Creating account...' : plan === 'pro' ? 'Create Pro Account' : 'Create Free Account'}
          </Button>
        </Form>

        <p className="text-center mt-3 mb-0 small">
          Already have an account?{' '}
          <button type="button" className="btn btn-link p-0 align-baseline" onClick={onSwitchToLogin}>
            Sign In
          </button>
        </p>

        <p className="text-center mt-3 mb-0 small text-muted">
          By creating an account, you agree to our{' '}
          <Link to="/terms" onClick={handleClose}>Terms of Service</Link> and{' '}
          <Link to="/privacy" onClick={handleClose}>Privacy Policy</Link>.
        </p>
      </Modal.Body>
    </Modal>
  );
}
