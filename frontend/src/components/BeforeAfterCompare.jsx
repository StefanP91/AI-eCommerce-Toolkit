import { useState } from 'react';
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

export default function BeforeAfterCompare() {
  const [position, setPosition] = useState(50);
  const [mode, setMode] = useState('slider');

  const showBefore = mode === 'before';
  const showAfter = mode === 'after';

  return (
    <div className="ba-compare-wrap">
      <div className="ba-toggle d-flex d-lg-none justify-content-center gap-2 mb-4">
        <button
          type="button"
          className={`ba-toggle-btn ${showBefore ? 'active' : ''}`}
          onClick={() => setMode('before')}
        >
          Before
        </button>
        <button
          type="button"
          className={`ba-toggle-btn ${showAfter ? 'active' : ''}`}
          onClick={() => setMode('after')}
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

      <div className="ba-compare d-none d-lg-block">
        <div className="ba-layer ba-layer-before">
          <MockStoreCard variant="before" />
        </div>
        <div
          className="ba-layer ba-layer-after"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <MockStoreCard variant="after" />
        </div>
        <div className="ba-labels" aria-hidden="true">
          <div
            className="ba-label ba-label-before"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          >
            Before
          </div>
          <div
            className="ba-label ba-label-after"
            style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          >
            After — AI Commerce Suite
          </div>
        </div>
        <div className="ba-handle" style={{ left: `${position}%` }}>
          <div className="ba-handle-line" />
          <div className="ba-handle-knob">⟷</div>
        </div>
        <input
          type="range"
          min={5}
          max={95}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="ba-slider"
          aria-label="Drag to compare before and after"
        />
      </div>

      <div className="d-lg-none">
        {showBefore && <MockStoreCard variant="before" />}
        {showAfter && <MockStoreCard variant="after" />}
        {mode === 'slider' && (
          <div className="ba-compare ba-compare-mobile">
            <div className="ba-layer ba-layer-before">
              <MockStoreCard variant="before" />
            </div>
            <div
              className="ba-layer ba-layer-after"
              style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
            >
              <MockStoreCard variant="after" />
            </div>
            <div className="ba-labels" aria-hidden="true">
              <div
                className="ba-label ba-label-before"
                style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
              >
                Before
              </div>
              <div
                className="ba-label ba-label-after"
                style={{ clipPath: `inset(0 0 0 ${position}%)` }}
              >
                After
              </div>
            </div>
            <div className="ba-handle" style={{ left: `${position}%` }}>
              <div className="ba-handle-line" />
              <div className="ba-handle-knob">⟷</div>
            </div>
            <input
              type="range"
              min={5}
              max={95}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              className="ba-slider"
              aria-label="Drag to compare before and after"
            />
          </div>
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
