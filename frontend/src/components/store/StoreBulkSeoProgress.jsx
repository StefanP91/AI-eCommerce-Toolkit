import { Alert, Button, Card, ProgressBar, Spinner } from 'react-bootstrap';
import { getStorePlatform } from '../../constants/storePlatforms';
import { scrollToGuidedSetup } from '../../utils/scrollToGuidedSetup';

function BulkFixCompleteActions({
  store,
  pushableCount,
  onPush,
  pushRunning,
}) {
  const platform = store?.platform ? getStorePlatform(store.platform) : null;
  const canPush = Boolean(store?.push_available && pushableCount > 0 && onPush);

  if (canPush) {
    return (
      <div className="mb-3">
        <p className="small text-muted mb-2">
          Optimized content is saved. Push {pushableCount} product{pushableCount === 1 ? '' : 's'} to your live store.
        </p>
        <Button
          variant="primary"
          size="sm"
          className="me-2"
          onClick={onPush}
          disabled={pushRunning}
        >
          {pushRunning ? 'Pushing...' : `Push ${pushableCount} to Shopify`}
        </Button>
      </div>
    );
  }

  if (store?.platform === 'shopify' && !store?.has_api_connection) {
    return (
      <div className="mb-3">
        <p className="small text-muted mb-2">
          Content is saved in AI Commerce Suite. Connect your Shopify store to push updates with one click.
        </p>
        <Button variant="primary" size="sm" className="me-2" onClick={scrollToGuidedSetup}>
          Connect store
        </Button>
      </div>
    );
  }

  if (platform) {
    return (
      <div className="mb-3">
        <Alert variant="light" className="small py-2 mb-2">
          One-click push is not available for {platform.label} yet.
          Export or copy the optimized content, then update products in your store admin.
        </Alert>
        <Button variant="primary" size="sm" className="me-2" onClick={scrollToGuidedSetup}>
          How to publish to {platform.label}
        </Button>
      </div>
    );
  }

  return null;
}

export default function StoreBulkSeoProgress({
  mode,
  items,
  currentIndex,
  currentLabel,
  error,
  onDismiss,
  store = null,
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

        {done && completedAction === 'fix' && (
          <BulkFixCompleteActions
            store={store}
            pushableCount={pushableCount}
            onPush={onPush}
            pushRunning={pushRunning}
          />
        )}

        {done && completedAction === 'audit' && (
          <p className="small text-muted mb-3">
            Review scores in the table below. Select products and run Fix SEO to generate optimized content.
          </p>
        )}

        {done && completedAction === 'push' && (
          <Alert variant="success" className="small py-2 mb-3">
            Products were pushed to Shopify. Live SEO scores will update after the next scan.
          </Alert>
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
