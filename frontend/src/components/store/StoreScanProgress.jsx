import { Alert, Card, ProgressBar, Spinner } from 'react-bootstrap';
import { formatScanEta } from '../../utils/runFullStoreScan';

export default function StoreScanProgress({
  active = false,
  phase = 'scanning',
  scanned = 0,
  total = 0,
  percent = 0,
  etaMs = null,
  error = '',
}) {
  if (!active && phase !== 'complete') {
    return null;
  }

  const done = phase === 'complete' || (total > 0 && scanned >= total);
  const label = done
    ? `Scan complete — ${scanned} product${scanned === 1 ? '' : 's'} audited`
    : total > 0
      ? `Scanning products: ${scanned} of ${total}`
      : 'Preparing product scan...';

  return (
    <Card className="border-0 shadow-sm mb-4 store-scan-progress">
      <Card.Body className="p-4">
        <div className="d-flex align-items-center gap-2 mb-2">
          {!done && <Spinner animation="border" size="sm" variant="primary" />}
          <strong>{done ? 'Store scan complete' : 'Scanning your store'}</strong>
        </div>

        <ProgressBar
          now={percent}
          animated={!done}
          striped={!done}
          variant={done ? 'success' : 'primary'}
          className="mb-2"
          style={{ height: '0.85rem' }}
        />

        <div className="d-flex flex-wrap justify-content-between gap-2">
          <span className="text-muted small">{label}</span>
          {!done && (
            <span className="text-muted small">{formatScanEta(etaMs)}</span>
          )}
        </div>

        {!done && total > 0 && (
          <p className="text-muted small mb-0 mt-2">
            Auditing live product pages for SEO scores. You can keep this tab open — scanning continues automatically.
          </p>
        )}

        {error && (
          <Alert variant="warning" className="small py-2 mt-3 mb-0">
            {error}
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
}
