import { useState } from 'react';
import { Button, Dropdown } from 'react-bootstrap';
import { downloadExport } from '../utils/download';

export default function ExportButtons({ productId, showCopyAll, onCopyAll }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format) => {
    setExporting(true);
    try {
      await downloadExport(productId, format);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="d-flex gap-2 flex-wrap">
      {showCopyAll && (
        <Button variant="outline-primary" size="sm" onClick={onCopyAll}>
          Copy All
        </Button>
      )}
      <Dropdown>
        <Dropdown.Toggle variant="primary" size="sm" disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export'}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item onClick={() => handleExport('txt')}>TXT</Dropdown.Item>
          <Dropdown.Item onClick={() => handleExport('csv')}>CSV</Dropdown.Item>
          <Dropdown.Item onClick={() => handleExport('excel')}>Excel</Dropdown.Item>
          <Dropdown.Item onClick={() => handleExport('json')}>JSON</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}
