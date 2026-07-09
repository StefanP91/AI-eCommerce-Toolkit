import { Badge, Button, Form, InputGroup } from 'react-bootstrap';

export const MAX_BULK_SEO_SELECT = 20;

export default function StoreProductTableToolbar({
  searchQuery,
  onSearchChange,
  filteredCount,
  totalCount,
  selectedCount,
  onSelectAllFiltered,
  onClearSelection,
  onBulkAudit,
  onBulkFix,
  bulkRunning = false,
  bulkMode = null,
  allVisibleSelected = false,
}) {
  const allFilteredSelected = allVisibleSelected;

  return (
    <div className="p-3 border-bottom bg-white">
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <InputGroup style={{ maxWidth: 420 }} className="flex-grow-1">
          <InputGroup.Text>🔍</InputGroup.Text>
          <Form.Control
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by product name or URL..."
            aria-label="Search products"
          />
        </InputGroup>
        <small className="text-muted">
          {searchQuery.trim()
            ? `${filteredCount} of ${totalCount} shown`
            : `${totalCount} products`}
        </small>
      </div>

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
