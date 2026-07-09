import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../BrandLogo';

export default function LoginModal({ show, onHide, onSwitchToRegister }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setError('');
    onHide();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      handleClose();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.email?.[0] || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered className="auth-modal">
      <Modal.Header closeButton className="border-0 pb-0" />
      <Modal.Body className="px-4 pt-0 pb-4">
        <div className="text-center mb-4">
          <BrandLogo variant="light" className="brand-logo-auth mb-3" />
          <p className="text-muted mb-0">Optimize your eCommerce products in seconds</p>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Form.Group>

          <div className="d-flex justify-content-end mb-3">
            <Link to="/forgot-password" className="small" onClick={handleClose}>
              Forgot password?
            </Link>
          </div>

          <Button type="submit" variant="primary" className="w-100" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </Form>

        <p className="text-center mt-3 mb-0 small">
          Don&apos;t have an account?{' '}
          <button type="button" className="btn btn-link p-0 align-baseline" onClick={onSwitchToRegister}>
            Register
          </button>
        </p>

        <p className="text-center mt-3 mb-0 small text-muted">
          <Link to="/privacy" onClick={handleClose}>Privacy Policy</Link>
          {' · '}
          <Link to="/terms" onClick={handleClose}>Terms of Service</Link>
        </p>
      </Modal.Body>
    </Modal>
  );
}
