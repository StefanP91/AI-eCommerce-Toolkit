import { Badge, Button, ButtonGroup, Form, InputGroup } from 'react-bootstrap';

export const MAX_BULK_SEO_SELECT = 20;

export const SEO_SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'worst', label: 'Worst SEO' },
  { value: 'best', label: 'Best SEO' },
];

export default function StoreProductTableToolbar({
  searchQuery,
  onSearchChange,
  seoSort,
  onSeoSortChange,
  filteredCount,
  totalCount,
  selectedCount,
  onSelectAllFiltered,
  onClearSelection,
  onBulkAudit,
  onBulkFix,
  onBulkPush,
  pushAvailable = false,
  pushableCount = 0,
  bulkRunning = false,
  bulkMode = null,
  allVisibleSelected = false,
}) {
  const allFilteredSelected = allVisibleSelected;

  return (
    <div className="p-3 border-bottom bg-white">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <InputGroup style={{ flex: '1 1 240px', maxWidth: 420 }}>
          <InputGroup.Text>🔍</InputGroup.Text>
          <Form.Control
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by product name or URL..."
            aria-label="Search products"
          />
        </InputGroup>
        <div className="d-flex align-items-center gap-2 ms-auto flex-wrap">
          <small className="text-muted">Sort by SEO:</small>
          <ButtonGroup size="sm">
            {SEO_SORT_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={seoSort === option.value ? 'primary' : 'outline-secondary'}
                onClick={() => onSeoSortChange(option.value)}
                disabled={bulkRunning}
              >
                {option.label}
              </Button>
            ))}
          </ButtonGroup>
        </div>
      </div>

      <small className="text-muted d-block mb-2">
        {searchQuery.trim()
          ? `${filteredCount} of ${totalCount} shown`
          : `${totalCount} products`}
      </small>

      {selectedCount > 0 && (
        <div className="d-flex flex-wrap align-items-center gap-2 p-2 rounded bg-light border">
          <Badge bg="primary">{selectedCount} selected</Badge>
          <span className="text-muted small">Max {MAX_BULK_SEO_SELECT} for bulk SEO</span>
          <div className="ms-auto d-flex flex-wrap gap-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={onClearSelection}
              disabled={bulkRunning}
            >
              Clear
            </Button>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={onBulkAudit}
              disabled={bulkRunning}
            >
              {bulkMode === 'audit' ? 'Auditing...' : 'Audit selected'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onBulkFix}
              disabled={bulkRunning}
            >
              {bulkMode === 'fix' ? 'Fixing...' : 'Fix SEO for selected'}
            </Button>
            {pushAvailable && (
              <Button
                variant="success"
                size="sm"
                onClick={onBulkPush}
                disabled={bulkRunning || pushableCount === 0}
                title={pushableCount === 0 ? 'Run Fix SEO first on selected products' : undefined}
              >
                {bulkMode === 'push' ? 'Pushing...' : `Push to Shopify (${pushableCount})`}
              </Button>
            )}
          </div>
        </div>
      )}

      {filteredCount > 0 && (
        <div className="mt-2">
          <Form.Check
            type="checkbox"
            id="select-all-filtered-products"
            label={`Select all visible (${Math.min(filteredCount, MAX_BULK_SEO_SELECT)})`}
            checked={allFilteredSelected}
            onChange={(e) => onSelectAllFiltered(e.target.checked)}
            disabled={bulkRunning}
          />
        </div>
      )}
    </div>
  );
}
