import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Row, Col, Card, Button, Badge, Alert, ListGroup } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { PLANS } from '../constants/plans';
import api from '../api/client';

export default function Pricing() {
  const { user } = useAuth();
  const [credits, setCredits] = useState(null);
  const isPro = user?.plan === 'pro';

  useEffect(() => {
    api.get('/credits').then((res) => setCredits(res.data)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="text-center mb-5">
        <h3 className="mb-2">Choose Your Plan</h3>
        <p className="text-muted mb-0">
          Scale your eCommerce content with AI — start free, upgrade when you need more.
        </p>
      </div>

      {isPro && (
        <Alert variant="success" className="text-center mb-4">
          You&apos;re on <strong>Pro</strong> — enjoy unlimited AI generations and products.
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
                    <Button variant="primary" className="w-100 pricing-upgrade-btn" disabled>
                      Upgrade to Pro — Coming Soon
                    </Button>
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
          Stripe checkout will be available in the next update.{' '}
          <Link to="/settings">Manage your account</Link>
        </p>
      )}
    </div>
  );
}
