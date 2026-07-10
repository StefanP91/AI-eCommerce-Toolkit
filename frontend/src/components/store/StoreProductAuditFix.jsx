import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Spinner } from 'react-bootstrap';
import api from '../../api/client';
import SeoScore from '../SeoScore';
import ProductResults from '../ProductResults';
import { notifyCreditsUpdated } from '../../utils/credits';

const GENERATE_DEFAULTS = {
  language: 'en',
  tone: 'professional',
  target_country: 'US',
  category: 'General',
};

const AUDIT_STEPS = [
  'Fetching product page...',
  'Analyzing page title and meta tags...',
  'Checking headings and content structure...',
  'Reviewing images and schema markup...',
  'Calculating SEO score...',
];

export default function StoreProductAuditFix({
  product,
  store,
  onClose,
  onStoreRefresh = null,
}) {
  const panelRef = useRef(null);
  const [phase, setPhase] = useState('auditing');
  const [auditStep, setAuditStep] = useState(0);
  const [auditResult, setAuditResult] = useState(null);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [livePageAudit, setLivePageAudit] = useState(null);
  const [refreshingAfterPush, setRefreshingAfterPush] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (phase !== 'auditing') return undefined;

    const interval = setInterval(() => {
      setAuditStep((current) => (current < AUDIT_STEPS.length - 1 ? current + 1 : current));
    }, 1200);

    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    runAudit();
  }, [product.id]);

  const syncAuditResult = async (data) => {
    setAuditResult(data);
    await onStoreRefresh?.({
      store: data.store ?? null,
      mergeProduct: data.store_product ?? null,
      skipProductsRefetch: true,
    });
  };

  const runAudit = async (afterPush = false) => {
    setPhase('auditing');
    setRefreshingAfterPush(afterPush);
    setError('');
    if (!afterPush) {
      setGeneratedResult(null);
      setLivePageAudit(null);
    }
    setAuditStep(0);

    try {
      if (afterPush) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      const res = await api.post('/store/audit-url', {
        product_url: product.url,
        bust_cache: true,
      });
      await syncAuditResult(res.data);
      if (afterPush) {
        setLivePageAudit(res.data);
        setAuditResult((previous) => previous ?? res.data);
        setPhase('done');
      } else {
        setPhase('audit_done');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Audit failed. Please try again.');
      setPhase(generatedResult ? 'done' : 'audit_done');
    }
  };

  const handleFix = async () => {
    setPhase('fixing');
    setError('');
    setLivePageAudit(null);

    try {
      const res = await api.post('/products/generate', {
        input_type: 'url',
        product_url: auditResult?.extracted?.url || product.url,
        ...GENERATE_DEFAULTS,
      });

      const saveRes = await api.post('/products', {
        ...res.data.input,
        generated_content: res.data.content,
        seo_score: res.data.seo_score,
        seo_checks: res.data.seo_checks,
        history_id: res.data.history_id,
      });

      setGeneratedResult({
        ...res.data,
        product: saveRes.data.product,
        saved: true,
      });
      setPhase('done');
      notifyCreditsUpdated();
    } catch (err) {
      setError(err.response?.data?.message || 'AI fix failed. Please try again.');
      setPhase('audit_done');
    }
  };

  const handlePushSuccess = async (pushData) => {
    if (pushData?.store_product) {
      await onStoreRefresh?.({
        store: pushData.store ?? null,
        mergeProduct: pushData.store_product,
        skipProductsRefetch: true,
      });
      const score = pushData.live_score ?? pushData.store_product.seo_score;
      if (score != null) {
        setLivePageAudit({
          score,
          checks: pushData.store_product.seo_checks ?? {},
        });
      }
      setPhase('done');
      return;
    }

    await runAudit(true);
  };

  const canFix = auditResult && (auditResult.score < 100 || auditResult.recommendations?.length > 0);
  const currentLiveAudit = livePageAudit ?? auditResult;

  return (
    <Card ref={panelRef} className="border-0 shadow-sm mb-4 border-primary border-2">
      <Card.Header className="bg-white d-flex justify-content-between align-items-start gap-3">
        <div className="min-w-0">
          <strong>Audit &amp; Fix:</strong> {product.product_name || 'Product'}
          <div className="small text-muted text-truncate">{product.url}</div>
        </div>
        <Button variant="outline-secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </Card.Header>
      <Card.Body className="p-4">
        {error && <Alert variant="danger">{error}</Alert>}

        {phase === 'auditing' && (
          <div className="py-3">
            <div className="d-flex align-items-center gap-3 mb-4">
              <Spinner animation="border" variant="primary" />
              <div>
                <h5 className="mb-1">
                  {refreshingAfterPush ? 'Refreshing live page score' : 'Running SEO Audit'}
                </h5>
                <p className="text-muted mb-0">{AUDIT_STEPS[auditStep]}</p>
              </div>
            </div>
            <ul className="list-unstyled small mb-0">
              {AUDIT_STEPS.map((step, index) => (
                <li
                  key={step}
                  className={`mb-2 ${index <= auditStep ? 'text-primary' : 'text-muted'}`}
                >
                  {index < auditStep ? '✓ ' : index === auditStep ? '→ ' : '○ '}
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {phase === 'audit_done' && !auditResult && (
          <div className="text-center py-3">
            <Button variant="outline-primary" onClick={() => runAudit()}>
              Retry Audit
            </Button>
          </div>
        )}

        {phase === 'audit_done' && auditResult && (
          <>
            <small className="text-muted text-uppercase fw-semibold d-block mb-2">Live page score</small>
            <SeoScore score={auditResult.score} checks={auditResult.checks} />

            {auditResult.recommendations?.length > 0 && (
              <Card className="border mb-4">
                <Card.Header className="bg-white fw-semibold">Issues found</Card.Header>
                <Card.Body>
                  <ul className="mb-0 ps-3">
                    {auditResult.recommendations.map((tip) => (
                      <li key={tip} className="mb-2">{tip}</li>
                    ))}
                  </ul>
                </Card.Body>
              </Card>
            )}

            {canFix ? (
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div>
                  <h6 className="mb-1">Fix SEO issues with AI</h6>
                  <p className="text-muted small mb-0">
                    Generate optimized content and push directly to your store.
                  </p>
                </div>
                <Button variant="primary" onClick={handleFix}>
                  Fix with AI
                </Button>
              </div>
            ) : (
              <Alert variant="success" className="mb-0">
                This product already has a strong SEO score. No fixes needed.
              </Alert>
            )}
          </>
        )}

        {phase === 'fixing' && (
          <div className="d-flex align-items-center gap-3 py-4">
            <Spinner animation="border" variant="primary" />
            <div>
              <h5 className="mb-1">Fixing SEO with AI</h5>
              <p className="text-muted mb-0">
                Generating optimized content and saving your project...
              </p>
            </div>
          </div>
        )}

        {phase === 'done' && generatedResult && auditResult && (
          <>
            {!livePageAudit && (
              <Alert variant="info" className="py-2">
                Content is ready. Push to Shopify to update your live page score below.
              </Alert>
            )}

            {livePageAudit && auditResult && livePageAudit.score !== auditResult.score && (
              <Alert variant="success" className="py-2">
                Live page score updated from <strong>{auditResult.score}</strong> to{' '}
                <strong>{livePageAudit.score}</strong>/100 after push.
              </Alert>
            )}

            {currentLiveAudit && (
              <>
                <small className="text-muted text-uppercase fw-semibold d-block mb-2">Live page score</small>
                <SeoScore score={currentLiveAudit.score} checks={currentLiveAudit.checks} />
              </>
            )}

            <ProductResults
              result={generatedResult}
              store={store}
              storeProductUrl={product.url}
              onPushSuccess={handlePushSuccess}
              hideSeoScore
              showStorePublish
            />
          </>
        )}
      </Card.Body>
    </Card>
  );
}
