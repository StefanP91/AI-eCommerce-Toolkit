import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Badge, Nav, Tab, Spinner } from 'react-bootstrap';
import SeoScore from './SeoScore';
import ExportButtons from './ExportButtons';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline-secondary" size="sm" onClick={handleCopy}>
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  );
}

function FieldCard({ title, value, multiline = false }) {
  const displayValue = Array.isArray(value) ? value.join(', ') : value;

  return (
    <Card className="border-0 shadow-sm mb-3">
      <Card.Header className="bg-white d-flex justify-content-between align-items-center">
        <strong>{title}</strong>
        <CopyButton text={displayValue} />
      </Card.Header>
      <Card.Body>
        {multiline ? (
          <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{displayValue}</p>
        ) : (
          <span>{displayValue}</span>
        )}
      </Card.Body>
    </Card>
  );
}

export default function ProductResults({ result, onSave, saving = false }) {
  const { content, seo_score, seo_checks, product } = result;
  const isSaved = Boolean(product?.id);

  const handleCopyAll = async () => {
    const allText = [
      `SEO Title: ${content.seo_title}`,
      `\nDescription:\n${content.description}`,
      `\nShort Description: ${content.short_description}`,
      `\nMeta Title: ${content.meta_title}`,
      `\nMeta Description: ${content.meta_description}`,
      `\nAlt Text: ${content.image_alt_text}`,
      `\nKeywords: ${content.keywords?.join(', ')}`,
      `\nTags: ${content.tags?.join(', ')}`,
      `\nFeatures:\n${content.features?.map((f) => `• ${f}`).join('\n')}`,
      `\nBenefits:\n${content.benefits?.map((b) => `• ${b}`).join('\n')}`,
      `\nFAQs:\n${content.faqs?.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}`,
    ].join('\n');
    await navigator.clipboard.writeText(allText);
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h4 className="mb-0">Generated Content</h4>
        <div className="d-flex gap-2 flex-wrap">
          {!isSaved && onSave && (
            <Button variant="success" size="sm" onClick={onSave} disabled={saving}>
              {saving ? (
                <>
                  <Spinner animation="border" size="sm" className="me-1" />
                  Saving...
                </>
              ) : (
                '💾 Save Project'
              )}
            </Button>
          )}
          {isSaved && (
            <>
              <Button variant="outline-success" size="sm" disabled>
                ✓ Saved
              </Button>
              <Link to={`/projects/${product.id}`}>
                <Button variant="outline-primary" size="sm">View in Projects</Button>
              </Link>
              <ExportButtons productId={product.id} showCopyAll onCopyAll={handleCopyAll} />
            </>
          )}
          {!isSaved && (
            <Button variant="outline-secondary" size="sm" onClick={handleCopyAll}>
              Copy All
            </Button>
          )}
        </div>
      </div>

      {!isSaved && (
        <p className="text-muted small mb-3">
          Preview only — click <strong>Save Project</strong> to add this product to your library.
        </p>
      )}

      <SeoScore score={seo_score} checks={seo_checks} />

      <Tab.Container defaultActiveKey="content">
        <Nav variant="tabs" className="mb-3">
          <Nav.Item><Nav.Link eventKey="content">Content</Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="seo">SEO</Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="faqs">FAQs</Nav.Link></Nav.Item>
        </Nav>

        <Tab.Content>
          <Tab.Pane eventKey="content">
            <FieldCard title="SEO Product Title" value={content.seo_title} />
            <FieldCard title="Product Description" value={content.description} multiline />
            <FieldCard title="Short Description" value={content.short_description} />
            <FieldCard title="Features" value={content.features?.map((f) => `• ${f}`).join('\n')} multiline />
            <FieldCard title="Benefits" value={content.benefits?.map((b) => `• ${b}`).join('\n')} multiline />
          </Tab.Pane>

          <Tab.Pane eventKey="seo">
            <FieldCard title="Meta Title" value={content.meta_title} />
            <FieldCard title="Meta Description" value={content.meta_description} />
            <FieldCard title="Image Alt Text" value={content.image_alt_text} />
            <FieldCard title="Keywords" value={content.keywords} />
            <div className="mb-3">
              <strong className="d-block mb-2">Product Tags</strong>
              <div className="d-flex flex-wrap gap-2">
                {content.tags?.map((tag) => (
                  <Badge key={tag} bg="secondary">{tag}</Badge>
                ))}
              </div>
            </div>
          </Tab.Pane>

          <Tab.Pane eventKey="faqs">
            {content.faqs?.map((faq, i) => (
              <Card key={i} className="border-0 shadow-sm mb-3">
                <Card.Body>
                  <div className="d-flex justify-content-between">
                    <strong>Q: {faq.question}</strong>
                    <CopyButton text={`Q: ${faq.question}\nA: ${faq.answer}`} />
                  </div>
                  <p className="mb-0 mt-2 text-muted">A: {faq.answer}</p>
                </Card.Body>
              </Card>
            ))}
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </div>
  );
}
