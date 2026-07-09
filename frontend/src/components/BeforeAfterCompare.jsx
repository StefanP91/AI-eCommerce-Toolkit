import { useState, useEffect, useRef } from 'react';
import { Badge } from 'react-bootstrap';

function MockStoreCard({ variant }) {
  const isAfter = variant === 'after';

  return (
    <div className={`ba-mock-card ${isAfter ? 'ba-mock-after' : 'ba-mock-before'}`}>
      <div className="ba-mock-browser">
        <span /><span /><span />
        <div className="ba-mock-url">
          {isAfter ? 'yourstore.com/products/ergonomic-office-chair-pro' : 'yourstore.com/products/chair-123'}
        </div>
      </div>
      <div className="ba-mock-body">
        <div className="ba-mock-image" aria-hidden="true">
          {isAfter ? '🪑' : '📦'}
        </div>
        <div className="ba-mock-content">
          <h4 className="ba-mock-title">
            {isAfter
              ? 'Ergonomic Office Chair Pro — Lumbar Support & Adjustable Arms'
              : 'Chair'}
          </h4>
          {isAfter ? (
            <Badge bg="success" className="mb-2">SEO Score: 92</Badge>
          ) : (
            <Badge bg="danger" className="mb-2">SEO Score: 34</Badge>
          )}
          <p className="ba-mock-desc">
            {isAfter
              ? 'Upgrade your workspace with breathable mesh, 4D armrests, and lumbar support designed for 8+ hour workdays. Ideal for home offices and remote teams.'
              : 'Nice chair for office. Good quality.'}
          </p>
          {isAfter ? (
            <ul className="ba-mock-bullets">
              <li>Adjustable lumbar support</li>
              <li>Breathable mesh backrest</li>
              <li>360° swivel & smooth casters</li>
            </ul>
          ) : (
            <p className="ba-mock-missing text-muted small mb-0">No bullet points · No keywords · No schema</p>
          )}
        </div>
      </div>
      <div className="ba-mock-google">
        <small className="text-muted d-block mb-1">Google preview</small>
        <div className="ba-google-title">
          {isAfter
            ? 'Ergonomic Office Chair Pro | Lumbar Support — Your Store'
            : 'Chair — Your Store'}
        </div>
        <div className="ba-google-url">yourstore.com › products › …</div>
        <div className="ba-google-desc">
          {isAfter
            ? 'Shop the Ergonomic Office Chair Pro with adjustable arms, mesh back, and lumbar support. Free shipping. Perfect for home office…'
            : 'Nice chair for office. Good quality.'}
        </div>
      </div>
    </div>
  );
}

function CompareSlider({ split, onChange, afterLabel, className = '', showHint, animating }) {
  const afterPercent = 100 - split;

  return (
    <div className={`ba-compare ${animating ? 'ba-compare-animating' : ''} ${className}`.trim()}>
      <div className="ba-layer ba-layer-before">
        <MockStoreCard variant="before" />
      </div>
      <div
        className="ba-layer ba-layer-after"
        style={{ clipPath: `inset(0 0 0 ${split}%)` }}
      >
        <MockStoreCard variant="after" />
      </div>

      <div className="ba-labels" aria-hidden="true">
        <div className="ba-label-zone ba-label-zone-before" style={{ width: `${split}%` }}>
          <span className="ba-label ba-label-before">Before</span>
        </div>
        <div
          className="ba-label-zone ba-label-zone-after"
          style={{ left: `${split}%`, width: `${afterPercent}%` }}
        >
          <span className="ba-label ba-label-after">{afterLabel}</span>
        </div>
      </div>

      <div className={`ba-handle ${showHint ? 'ba-handle-hint' : ''}`} style={{ left: `${split}%` }}>
        <div className="ba-handle-line" />
        <div className="ba-handle-knob">
          <span className="ba-handle-arrow ba-handle-arrow-left" aria-hidden="true">‹</span>
          <span className="ba-handle-arrow ba-handle-arrow-right" aria-hidden="true">›</span>
        </div>
      </div>

      {showHint && (
        <div className="ba-drag-hint" style={{ left: `${split}%` }}>
          Drag to compare
        </div>
      )}

      <input
        type="range"
        min={0}
        max={100}
        value={split}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={() => onChange(split, true)}
        className="ba-slider"
        aria-label="Drag to compare before and after"
      />
    </div>
  );
}

export default function BeforeAfterCompare() {
  const [split, setSplit] = useState(50);
  const [mode, setMode] = useState('slider');
  const [showHint, setShowHint] = useState(true);
  const [animating, setAnimating] = useState(false);
  const wrapRef = useRef(null);

  const showBefore = mode === 'before';
  const showAfter = mode === 'after';

  const handleSplitChange = (value, interacted = false) => {
    if (interacted || value !== split) {
      setShowHint(false);
      setAnimating(false);
    }
    setSplit(value);
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || mode !== 'slider') {
      return undefined;
    }

    let cancelled = false;
    const timeouts = [];

    const schedule = (fn, delay) => {
      timeouts.push(window.setTimeout(() => {
        if (!cancelled) {
          fn();
        }
      }, delay));
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || cancelled) {
          return;
        }

        observer.disconnect();

        schedule(() => {
          setAnimating(true);
          const sequence = [100, 0, 50];
          sequence.forEach((value, index) => {
            schedule(() => setSplit(value), index * 1200);
          });
          schedule(() => setAnimating(false), sequence.length * 1200 + 200);
        }, 1000);
      },
      { threshold: 0.35 },
    );

    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
      timeouts.forEach((id) => window.clearTimeout(id));
      setAnimating(false);
    };
  }, [mode]);

  return (
    <div className="ba-compare-wrap" ref={wrapRef}>
      <div className="ba-toggle d-flex d-lg-none justify-content-center gap-2 mb-4">
        <button
          type="button"
          className={`ba-toggle-btn ${showBefore ? 'active' : ''}`}
          onClick={() => { setShowHint(false); setMode('before'); }}
        >
          Before
        </button>
        <button
          type="button"
          className={`ba-toggle-btn ${showAfter ? 'active' : ''}`}
          onClick={() => { setShowHint(false); setMode('after'); }}
        >
          After
        </button>
        <button
          type="button"
          className={`ba-toggle-btn ${mode === 'slider' ? 'active' : ''}`}
          onClick={() => setMode('slider')}
        >
          Compare
        </button>
      </div>

      <CompareSlider
        split={split}
        onChange={handleSplitChange}
        afterLabel="After — AI Commerce Suite"
        className="d-none d-lg-block"
        showHint={showHint}
        animating={animating}
      />

      <div className="d-lg-none">
        {showBefore && <MockStoreCard variant="before" />}
        {showAfter && <MockStoreCard variant="after" />}
        {mode === 'slider' && (
          <CompareSlider
            split={split}
            onChange={handleSplitChange}
            afterLabel="After"
            className="ba-compare-mobile"
            showHint={showHint}
            animating={animating}
          />
        )}
      </div>

      <div className="ba-stats row g-3 mt-4">
        {[
          ['SEO Score', '34 → 92', '+171%'],
          ['Meta tags', 'Missing → Optimized', '✓'],
          ['Bullet points', '0 → 5+', '✓'],
          ['Time spent', '2+ hours → 30 sec', '⚡'],
        ].map(([label, change, badge]) => (
          <div key={label} className="col-6 col-md-3">
            <div className="ba-stat-card">
              <small className="text-muted">{label}</small>
              <div className="fw-semibold">{change}</div>
              <span className="ba-stat-badge">{badge}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
