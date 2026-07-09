import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, Navbar, Nav, Button } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import BrandLogo from './BrandLogo';

export default function LandingNavbar() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Navbar
      expand="lg"
      variant="dark"
      className={`landing-navbar py-3${scrolled ? ' landing-navbar-scrolled' : ''}`}
      sticky="top"
    >
      <Container>
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center py-0">
          <BrandLogo variant="dark" className="brand-logo-navbar" />
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="landing-nav" />
        <Navbar.Collapse id="landing-nav">
          <Nav className="ms-auto align-items-lg-center gap-lg-2">
            <Nav.Link href="#before-after">Before & After</Nav.Link>
            <Nav.Link href="#features">Features</Nav.Link>
            <Nav.Link href="#pricing">Pricing</Nav.Link>
            {user ? (
              <Button as={Link} to="/dashboard" variant="primary" size="sm" className="ms-lg-2">
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Nav.Link as={Link} to="/login">Sign In</Nav.Link>
                <Button as={Link} to="/register" variant="primary" size="sm" className="ms-lg-2">
                  Start Free
                </Button>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
