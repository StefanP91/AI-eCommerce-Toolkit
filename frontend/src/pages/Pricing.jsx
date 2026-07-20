import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Row, Col, Card, Button, Badge, Alert, ListGroup, Spinner } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { PLANS } from '../constants/plans';
import api from '../api/client';

export default function Pricing() {
  const { user, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [credits, setCredits] = useState(null);
  const [billing, setBilling] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const isPro = user?.plan === 'pro';

  useEffect(() => {
    api.get('/credits').then((res) => setCredits(res.data)).catch(() => {});

    if (user) {
      api.get('/billing/status')
        .then((res) => setBilling(res.data))
        .catch(() => setBilling({ configured: false }));
    }
  }, [user]);

  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout !== 'success') return;

    setSuccessMessage('Payment received. Activating Pro — this usually takes a few seconds.');
    searchParams.delete('checkout');
    setSearchParams(searchParams, { replace: true });

    const refresh = async () => {
      try {
        await refreshUser?.();
        const [creditsRes, billingRes] = await Promise.all([
          api.get('/credits'),
          api.get('/billing/status'),
        ]);
        setCredits(creditsRes.data);
        setBilling(billingRes.data);
        if (billingRes.data?.plan === 'pro') {
          setSuccessMessage('Welcome to Pro! Unlimited AI generations are unlocked.');
        }
      } catch {
        // webhook may still be processing
      }
    };

    refresh();
    const timer = window.setTimeout(refresh, 2500);
    return () => window.clearTimeout(timer);
  }, [searchParams, setSearchParams, refreshUser]);

  useEffect(() => {
    if (!user || searchParams.get('checkout') !== 'start') return;
    if (user.plan === 'pro') return;

    searchParams.delete('checkout');
    setSearchParams(searchParams, { replace: true });

    const autoStart = async () => {
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

    void autoStart();
  }, [user, searchParams, setSearchParams]);

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

  const billingReady = billing?.configured !== false;

  return (
    <div>
      <div className="text-center mb-5">
        <h3 className="mb-2">Choose Your Plan</h3>
        <p className="text-muted mb-0">
          Scale your eCommerce content with AI — start free, upgrade when you need more.
        </p>
      </div>

      {successMessage && (
        <Alert variant="success" className="text-center mb-4" onClose={() => setSuccessMessage('')} dismissible>
          {successMessage}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" className="text-center mb-4" onClose={() => setError('')} dismissible>
          {error}
        </Alert>
      )}

      {isPro && (
        <Alert variant="success" className="text-center mb-4">
          You&apos;re on <strong>Pro</strong> — enjoy unlimited AI generations and products.
          {billing?.has_subscription && (
            <>
              {' '}
              <Button
                variant="link"
                className="p-0 align-baseline"
                onClick={openPortal}
                disabled={portalLoading}
              >
                {portalLoading ? 'Opening…' : 'Manage billing'}
              </Button>
            </>
          )}
        </Alert>
      )}

      {!isPro && credits && (credits.generations_remaining <= 5 || credits.products_remaining <= 10) && (
        <Alert variant="warning" className="text-center mb-4">
          You&apos;re running low on credits — upgrade to Pro for unlimited access.
        </Alert>
      )}

      <Row className="g-4 justify-content-center mb-5">
        {Object.values(PLANS).map((plan) => {
          const isCurrent = user?.plan === plan.id;
          const isProPlan = plan.id === 'pro';

          return (
            <Col key={plan.id} md={6} lg={5}>
              <Card className={`border-0 shadow-sm h-100 pricing-card ${isProPlan ? 'pricing-card-pro' : ''}`}>
                {plan.popular && (
                  <div className="pricing-badge">
                    <Badge bg="primary">Most Popular</Badge>
                  </div>
                )}
                <Card.Body className="p-4 d-flex flex-column">
                  <div className="mb-3">
                    <h4 className="mb-1">{plan.name}</h4>
                    <p className="text-muted small mb-0">{plan.description}</p>
                  </div>

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

                  <ListGroup variant="flush" className="mb-4 flex-grow-1">
                    {plan.features.map((feature) => (
                      <ListGroup.Item key={feature} className="px-0 border-0 py-2">
                        <span className="text-success me-2">✓</span>
                        {feature}
                      </ListGroup.Item>
                    ))}
                    {plan.limitations.map((limit) => (
                      <ListGroup.Item key={limit} className="px-0 border-0 py-2 text-muted">
                        <span className="me-2">○</span>
                        {limit}
                      </ListGroup.Item>
                    ))}
                  </ListGroup>

                  {isCurrent ? (
                    <Button variant="outline-secondary" disabled className="w-100">
                      Current Plan
                    </Button>
                  ) : isProPlan ? (
                    !user ? (
                      <Link to="/register?plan=pro" className="w-100">
                        <Button variant="primary" className="w-100 pricing-upgrade-btn">
                          Sign up for Pro
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        variant="primary"
                        className="w-100 pricing-upgrade-btn"
                        onClick={startCheckout}
                        disabled={checkoutLoading || billing?.configured === false}
                      >
                        {checkoutLoading ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Redirecting…
                          </>
                        ) : billingReady ? (
                          'Upgrade to Pro — $19/mo'
                        ) : (
                          'Billing not configured'
                        )}
                      </Button>
                    )
                  ) : (
                    <Button variant="outline-primary" disabled className="w-100">
                      Free Plan
                    </Button>
                  )}
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white fw-semibold">Plan Comparison</Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th className="ps-4">Feature</th>
                  <th className="text-center">Free</th>
                  <th className="text-center">Pro</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['AI generations', '20 / day', 'Unlimited'],
                  ['Saved products', '50 / month', 'Unlimited'],
                  ['AI Product Generator', '✓', '✓'],
                  ['Bulk Upload', '✓', '✓'],
                  ['SEO Audit & Tools', '✓', '✓'],
                  ['Schema Generator', '✓ (free)', '✓'],
                  ['Export formats', 'All', 'All'],
                  ['Store connect', '—', '✓'],
                  ['Priority support', '—', '✓'],
                ].map(([feature, free, pro]) => (
                  <tr key={feature}>
                    <td className="ps-4">{feature}</td>
                    <td className="text-center">{free}</td>
                    <td className="text-center fw-semibold text-primary">{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card.Body>
      </Card>

      {!isPro && (
        <p className="text-center text-muted small mt-4 mb-0">
          Secure checkout powered by Lemon Squeezy.{' '}
          <Link to="/settings">Manage your account</Link>
        </p>
      )}
    </div>
  );
}
