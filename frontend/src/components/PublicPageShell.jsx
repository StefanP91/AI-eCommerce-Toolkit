import { Link } from 'react-router-dom';
import { Container, Navbar, Nav, Button } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import BrandLogo from './BrandLogo';

export default function PublicPageShell({ children, maxWidth = 960 }) {
  const { user } = useAuth();

  return (
    <div className="public-page-shell min-vh-100" style={{ background: '#f8f9fa' }}>
      <Navbar bg="white" expand="lg" className="border-bottom shadow-sm py-2" sticky="top">
        <Container style={{ maxWidth }}>
          <Navbar.Brand as={Link} to="/" className="d-flex align-items-center py-0">
            <BrandLogo variant="light" className="brand-logo-navbar" />
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="public-nav" />
          <Navbar.Collapse id="public-nav">
            <Nav className="ms-auto align-items-lg-center gap-lg-2">
              <Nav.Link as={Link} to="/">Home</Nav.Link>
              <Nav.Link as={Link} to="/pricing">Pricing</Nav.Link>
              {user ? (
                <Button as={Link} to="/dashboard" variant="primary" size="sm" className="ms-lg-2">
                  Dashboard
                </Button>
              ) : (
                <>
                  <Nav.Link as={Link} to="/login">Sign In</Nav.Link>
                  <Button as={Link} to="/register?plan=free" variant="primary" size="sm" className="ms-lg-2">
                    Start Free
                  </Button>
                </>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container className="py-4 py-md-5" style={{ maxWidth }}>
        {children}
      </Container>

      <footer className="border-top bg-white py-3 mt-auto">
        <Container style={{ maxWidth }} className="d-flex flex-wrap justify-content-between gap-2 small text-muted">
          <span>© {new Date().getFullYear()} AI Commerce Suite</span>
          <div className="d-flex gap-3">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/pricing">Pricing</Link>
          </div>
        </Container>
      </footer>
    </div>
  );
}
