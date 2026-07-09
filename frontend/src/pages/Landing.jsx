import { Link, Navigate } from 'react-router-dom';
import { Container, Row, Col, Button, Card, Badge } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { PLANS } from '../constants/plans';
import LandingNavbar from '../components/LandingNavbar';
import BeforeAfterCompare from '../components/BeforeAfterCompare';

const FEATURES = [
  {
    icon: '✨',
    title: 'AI Product Generator',
    description: 'Full descriptions, SEO titles, bullet points, and FAQs from a product name, URL, or manual input.',
  },
  {
    icon: '🔍',
    title: 'SEO Audit & Meta Tools',
    description: 'Score product pages, generate meta titles and descriptions, and preview how they look on Google.',
  },
  {
    icon: '🌐',
    title: 'Translator',
    description: 'Localize listings across 12 languages to reach more marketplaces and international buyers.',
  },
  {
    icon: '🖼️',
    title: 'Image Optimizer',
    description: 'AI alt text, filename suggestions, compression, and SEO tips for product images.',
  },
  {
    icon: '{ }',
    title: 'Schema Generator',
    description: 'JSON-LD Product schema markup for rich search results and better visibility.',
  },
  {
    icon: '📤',
    title: 'Bulk Upload & Export',
    description: 'Process up to 100 products from CSV or Excel, then export to TXT, CSV, Excel, or JSON.',
  },
];

const STEPS = [
  { step: '1', title: 'Sign up free', text: 'Create your account in under a minute. No credit card required.' },
  { step: '2', title: 'Add a product', text: 'Enter a name, paste a URL, or fill in details manually.' },
  { step: '3', title: 'Generate & export', text: 'Get SEO-ready content in seconds and export to your store workflow.' },
];

const AUDIENCE = ['Shopify sellers', 'WooCommerce stores', 'BigCommerce', 'Amazon & Etsy', 'Dropshippers', 'SEO agencies'];

export default function Landing() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="landing-page">
      <LandingNavbar />

      <div className="landing-hero-shell">
        <section className="landing-hero">
          <Container>
          <Row className="align-items-center g-5">
            <Col lg={7}>
              <Badge bg="primary" className="landing-hero-badge mb-3">Built for eCommerce sellers</Badge>
              <h1 className="landing-hero-title">
                Optimize your eCommerce products in seconds with AI
              </h1>
              <p className="landing-hero-lead">
                Stop spending days writing product copy. AI Commerce Suite generates descriptions,
                SEO titles, meta tags, translations, and schema markup — then exports everything
                ready for your store.
              </p>
              <div className="d-flex flex-wrap gap-3">
                <Button as={Link} to="/register" variant="primary" size="lg">
                  Start Free — No Card Required
                </Button>
                <Button as={Link} to="/login" variant="outline-light" size="lg">
                  Sign In
                </Button>
              </div>
              <div className="landing-audience mt-4">
                {AUDIENCE.map((item) => (
                  <span key={item} className="landing-audience-tag">{item}</span>
                ))}
              </div>
            </Col>
            <Col lg={5}>
              <Card className="landing-preview-card border-0 shadow-lg">
                <Card.Body className="p-4">
                  <small className="text-muted text-uppercase fw-semibold">Sample output</small>
                  <h5 className="mt-2 mb-3">Wireless Ergonomic Office Chair</h5>
                  <div className="landing-preview-score mb-3">
                    <span className="landing-score-circle">92</span>
                    <div>
                      <strong>SEO Score</strong>
                      <div className="text-muted small">Title, meta, keywords, alt text — optimized</div>
                    </div>
                  </div>
                  <ul className="landing-preview-list small text-muted mb-0">
                    <li>SEO title & meta description with Google preview</li>
                    <li>Product description + bullet points</li>
                    <li>JSON-LD schema ready to paste</li>
                    <li>Export to CSV, Excel, or JSON</li>
                  </ul>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          </Container>
        </section>
      </div>

      <section id="before-after" className="landing-section landing-section-alt">
        <Container>
          <div className="text-center mb-5 landing-section-header">
            <h2>See the difference in seconds</h2>
            <p className="text-muted mb-0">
              Drag the slider to compare a basic listing vs. AI-optimized content from AI Commerce Suite.
            </p>
          </div>
          <BeforeAfterCompare />
        </Container>
      </section>

      <section id="features" className="landing-section">
        <Container>
          <div className="text-center mb-5 landing-section-header">
            <h2>Everything you need to list products faster</h2>
            <p className="text-muted mb-0">
              One toolkit for product content, SEO, translations, and bulk workflows — not another generic AI chat.
            </p>
          </div>
          <Row className="g-4">
            {FEATURES.map((feature) => (
              <Col key={feature.title} md={6} lg={4}>
                <Card className="landing-feature-card border-0 shadow-sm h-100">
                  <Card.Body className="p-4">
                    <div className="landing-feature-icon">{feature.icon}</div>
                    <h5 className="mb-2">{feature.title}</h5>
                    <p className="text-muted mb-0">{feature.description}</p>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <section className="landing-section landing-section-alt">
        <Container>
          <Row className="align-items-center g-5">
            <Col lg={5}>
              <h2>How it works</h2>
              <p className="text-muted">
                From blank product to publish-ready content in three simple steps.
              </p>
            </Col>
            <Col lg={7}>
              <div className="landing-steps">
                {STEPS.map((item) => (
                  <div key={item.step} className="landing-step">
                    <div className="landing-step-number">{item.step}</div>
                    <div>
                      <h5 className="mb-1">{item.title}</h5>
                      <p className="text-muted mb-0">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <section id="pricing" className="landing-section">
        <Container>
          <div className="text-center mb-5 landing-section-header">
            <h2>Simple, transparent pricing</h2>
            <p className="text-muted mb-0">Start free. Upgrade when you need unlimited AI power.</p>
          </div>
          <Row className="g-4 justify-content-center">
            {Object.values(PLANS).map((plan) => (
              <Col key={plan.id} md={6} lg={5}>
                <Card className={`border-0 shadow-sm h-100 pricing-card ${plan.popular ? 'pricing-card-pro' : ''}`}>
                  {plan.popular && (
                    <div className="pricing-badge">
                      <Badge bg="primary">Most Popular</Badge>
                    </div>
                  )}
                  <Card.Body className="p-4">
                    <h4 className="mb-1">{plan.name}</h4>
                    <p className="text-muted small">{plan.description}</p>
                    <div className="mb-4">
                      {plan.price === 0 ? (
                        <div className="pricing-price">$0</div>
                      ) : (
                        <div className="pricing-price">
                          ${plan.price}
                          <span className="pricing-period">/{plan.period}</span>
                        </div>
                      )}
                    </div>
                    <ul className="list-unstyled mb-4">
                      {plan.features.slice(0, 5).map((f) => (
                        <li key={f} className="mb-2 small">
                          <span className="text-success me-2">✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      as={Link}
                      to={plan.id === 'free' ? '/register' : '/register'}
                      variant={plan.popular ? 'primary' : 'outline-primary'}
                      className="w-100"
                    >
                      {plan.id === 'free' ? 'Get Started Free' : 'Start with Free, Upgrade Later'}
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <section className="landing-cta">
        <Container className="text-center">
          <h2 className="mb-3">Ready to speed up your product listings?</h2>
          <p className="landing-cta-lead mb-4">
            Join eCommerce sellers using AI Commerce Suite to create SEO-ready content in seconds.
          </p>
          <Button as={Link} to="/register" variant="light" size="lg" className="fw-semibold">
            Create Free Account
          </Button>
        </Container>
      </section>

      <footer className="landing-footer">
        <Container className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="d-flex align-items-center gap-2 text-white-50">
            <img src="/favicon.png" alt="" width={28} height={28} aria-hidden="true" />
            <span>AI Commerce Suite</span>
          </div>
          <div className="landing-footer-links">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/login">Sign In</Link>
          </div>
        </Container>
      </footer>
    </div>
  );
}
