import { Link } from 'react-router-dom';
import { Container } from 'react-bootstrap';

export default function LegalLayout({ title, children }) {
  return (
    <Container className="py-5" style={{ maxWidth: 800 }}>
      <div className="mb-4">
        <Link to="/" className="text-decoration-none small">
          ← Back to AI Commerce Suite
        </Link>
      </div>

      <h1 className="mb-2">{title}</h1>
      <p className="text-muted small mb-4">Last updated: July 9, 2026</p>

      <div className="legal-content">{children}</div>

      <hr className="my-4" />
      <p className="text-muted small mb-0 text-center">
        <Link to="/privacy">Privacy Policy</Link>
        {' · '}
        <Link to="/terms">Terms of Service</Link>
      </p>
    </Container>
  );
}
