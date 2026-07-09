import { useState } from 'react';
import { Card, Form, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const SUBJECTS = [
  'General question',
  'Billing & subscription',
  'Bug report',
  'Feature request',
  'Account issue',
];

export default function Support() {
  const { user } = useAuth();
  const [form, setForm] = useState({ subject: SUBJECTS[0], message: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await api.post('/support', form);
      setMessage(res.data.message);
      setForm((f) => ({ ...f, message: '' }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send support request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="mb-4">
        <h3 className="mb-1">Support</h3>
        <p className="text-muted mb-0">
          Need help with billing, your account, or a bug? Send us a message and we&apos;ll reply by email.
        </p>
      </div>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-4">
          <p className="small text-muted mb-3">
            Signed in as <strong>{user?.email}</strong>
          </p>

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Topic</Form.Label>
              <Form.Select
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Message</Form.Label>
              <Form.Control
                as="textarea"
                rows={6}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Describe your issue or question..."
                required
              />
            </Form.Group>

            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send Support Request'}
            </Button>
          </Form>
        </Card.Body>
      </Card>

      <p className="text-muted small mt-3 mb-0">
        You can also email us directly at{' '}
        <a href="mailto:stefanpanov0@gmail.com">stefanpanov0@gmail.com</a>.
      </p>
    </div>
  );
}
