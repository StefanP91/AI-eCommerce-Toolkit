import { Alert, Button, Card, ProgressBar, Spinner } from 'react-bootstrap';

export default function StoreBulkSeoProgress({
  mode,
  items,
  currentIndex,
  currentLabel,
  error,
  onDismiss,
  canPush = false,
  pushableCount = 0,
  onPush = null,
  pushRunning = false,
  completedAction = null,
}) {
  if (items.length === 0) return null;

  const activeMode = mode || completedAction || 'audit';
  const done = currentIndex >= items.length;
  const progress = Math.round((Math.min(currentIndex, items.length) / items.length) * 100);
  const title = activeMode === 'fix'
    ? 'Bulk SEO fix'
    : activeMode === 'push'
      ? 'Bulk push to Shopify'
      : 'Bulk live audit';

  return (
    <Card className="border-0 shadow-sm mb-3 mx-3 mt-3">
      <Card.Body>
        <div className="d-flex align-items-center gap-2 mb-2">
          {!done && <Spinner animation="border" size="sm" />}
          <strong>{done ? `${title} complete` : title}</strong>
        </div>
        <ProgressBar now={progress} className="mb-2" />
        <p className="text-muted small mb-2">
          {done
            ? `Finished ${items.length} product${items.length === 1 ? '' : 's'}.`
            : `Processing ${currentIndex + 1} of ${items.length}: ${currentLabel}`}
        </p>
        {error && <Alert variant="warning" className="py-2 small mb-2">{error}</Alert>}
        {done && canPush && pushableCount > 0 && onPush && completedAction === 'fix' && (
          <Button
            variant="primary"
            size="sm"
            className="me-2"
            onClick={onPush}
            disabled={pushRunning}
          >
            {pushRunning ? 'Pushing...' : `Push ${pushableCount} to Shopify`}
          </Button>
        )}
        {done && (
          <Button variant="outline-secondary" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </Card.Body>
    </Card>
  );
}
