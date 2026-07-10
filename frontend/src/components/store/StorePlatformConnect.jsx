import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Row,
  Spinner,
} from 'react-bootstrap';
import { getStorePlatform } from '../../constants/storePlatforms';
import StorePlatformLogo from './StorePlatformLogo';
import VisitorPasswordInput from './VisitorPasswordInput';

export default function StorePlatformConnect({
  platformId,
  storeUrl,
  onStoreUrlChange,
  visitorPassword,
  onVisitorPasswordChange,
  submitting,
  onSubmit,
  onBack,
}) {
  const platform = getStorePlatform(platformId);

  if (!platform) {
    return null;
  }

  return (
    <Card className="border-0 shadow-sm">
      <Card.Body className="p-4">
        <Button variant="link" className="px-0 mb-3 text-decoration-none" onClick={onBack}>
          ← Choose a different platform
        </Button>

        <div className="d-flex align-items-center gap-3 mb-3">
          <span className="store-platform-card__logo d-inline-flex" aria-hidden="true">
            <StorePlatformLogo platformId={platform.id} size={44} />
          </span>
          <div>
            <h5 className="mb-1">Connect {platform.label}</h5>
            <p className="text-muted mb-0 small">{platform.summary}</p>
          </div>
        </div>

        <Row className="g-4 mb-4">
          <Col lg={7}>
            <Card className="border h-100">
              <Card.Body>
                <h6 className="mb-2">How to connect</h6>
                <ol className="small ps-3 mb-3">
                  {platform.connectSteps.map((step) => (
                    <li key={step} className="mb-2">{step}</li>
                  ))}
                </ol>
                <a href={platform.docsUrl} target="_blank" rel="noreferrer" className="small">
                  Open {platform.label} documentation →
                </a>
              </Card.Body>
            </Card>
          </Col>

          <Col lg={5}>
            <Card className="border h-100 bg-light">
              <Card.Body>
                <h6 className="mb-2">After you connect</h6>
                {platform.supportsApiPush ? (
                  <>
                    <Badge bg="success" className="mb-2">Push to store available</Badge>
                    <p className="small text-muted mb-0">
                      Use Guided API setup{platform.supportsOAuth ? ' or Shopify OAuth' : ''} to enable
                      one-click publishing after your store is scanned.
                    </p>
                  </>
                ) : (
                  <>
                    <Badge bg="secondary" className="mb-2">Scan &amp; optimize</Badge>
                    <p className="small text-muted mb-2">
                      We audit live product pages from your public sitemap. Use export or
                      copy to update products in {platform.label}.
                    </p>
                    <ul className="small text-muted ps-3 mb-0">
                      {platform.publishSteps.map((step) => (
                        <li key={step} className="mb-1">{step}</li>
                      ))}
                    </ul>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Form onSubmit={onSubmit}>
          <Row className="g-3">
            <Col md={8}>
              <Form.Group>
                <Form.Label>Store URL</Form.Label>
                <Form.Control
                  type="url"
                  value={storeUrl}
                  onChange={(e) => onStoreUrlChange(e.target.value)}
                  placeholder={platform.urlPlaceholder}
                  required
                />
                <Form.Text className="text-muted">{platform.urlHelp}</Form.Text>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>
                  Visitor password <span className="text-muted fw-normal">(optional)</span>
                </Form.Label>
                <VisitorPasswordInput
                  id={`connect-visitor-password-${platform.id}`}
                  value={visitorPassword}
                  onChange={(e) => onVisitorPasswordChange(e.target.value)}
                  placeholder="Store password"
                />
                <Form.Text className="text-muted">{platform.passwordHelp}</Form.Text>
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Alert variant="info" className="small py-2 mb-0">
                We read your public sitemap and audit up to 15 product pages. No admin login required for scanning.
              </Alert>
            </Col>
            <Col xs={12} className="d-flex justify-content-end">
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Connecting...
                  </>
                ) : (
                  `Connect ${platform.label} store`
                )}
              </Button>
            </Col>
          </Row>
        </Form>
      </Card.Body>
    </Card>
  );
}
