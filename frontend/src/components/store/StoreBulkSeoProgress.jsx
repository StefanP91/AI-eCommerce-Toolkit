import { Alert, Card, ProgressBar, Spinner } from 'react-bootstrap';

export default function StoreBulkSeoProgress({
  mode,
  items,
  currentIndex,
  currentLabel,
  error,
  onDismiss,
}) {
  if (!mode || items.length === 0) return null;

  const done = currentIndex >= items.length;
  const progress = Math.round((Math.min(currentIndex, items.length) / items.length) * 100);
  const title = mode === 'fix' ? 'Bulk SEO fix' : 'Bulk live audit';

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
        {done && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </Card.Body>
    </Card>
  );
}
