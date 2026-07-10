import { Card, Col, Row } from 'react-bootstrap';
import { STORE_PLATFORMS } from '../../constants/storePlatforms';
import StorePlatformLogo from './StorePlatformLogo';

export default function StorePlatformPicker({ onSelect }) {
  return (
    <Card className="border-0 shadow-sm">
      <Card.Body className="p-4">
        <h5 className="mb-2">Which platform is your store on?</h5>
        <p className="text-muted mb-4">
          Choose your e-commerce platform. We&apos;ll show tailored setup steps for scanning
          product pages and connecting your store.
        </p>

        <Row className="g-3">
          {STORE_PLATFORMS.map((platform) => (
            <Col key={platform.id} xs={12} sm={6} lg={4} className="d-flex">
              <button
                type="button"
                className="store-platform-card w-100 text-start h-100"
                onClick={() => onSelect(platform.id)}
              >
                <span className="store-platform-card__logo" aria-hidden="true">
                  <StorePlatformLogo platformId={platform.id} size={36} />
                </span>
                <span className="store-platform-card__label">{platform.label}</span>
                <span
                  className={`store-platform-card__badge${platform.supportsApiPush ? '' : ' store-platform-card__badge--spacer'}`}
                  aria-hidden={!platform.supportsApiPush}
                >
                  One-click push
                </span>
              </button>
            </Col>
          ))}
        </Row>
      </Card.Body>
    </Card>
  );
}
