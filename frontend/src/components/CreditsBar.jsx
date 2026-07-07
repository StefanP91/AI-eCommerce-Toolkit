import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ProgressBar, Button } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import api from '../api/client';

export default function CreditsBar({ collapsed = false }) {
  const [credits, setCredits] = useState(null);
  const location = useLocation();

  const loadCredits = useCallback(() => {
    api.get('/credits').then((res) => setCredits(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadCredits();
  }, [loadCredits, location.pathname]);

  useEffect(() => {
    window.addEventListener('credits-updated', loadCredits);
    return () => window.removeEventListener('credits-updated', loadCredits);
  }, [loadCredits]);

  if (!credits || credits.plan === 'pro') {
    return collapsed ? null : (
      <div className="px-2 mb-2">
        <span className="badge bg-success w-100">PRO — Unlimited</span>
      </div>
    );
  }

  const dailyPct = credits.daily_limit
    ? Math.round((credits.generations_today / credits.daily_limit) * 100)
    : 0;
  const monthlyPct = credits.monthly_product_limit
    ? Math.round((credits.products_this_month / credits.monthly_product_limit) * 100)
    : 0;

  if (collapsed) {
    return (
      <div className="text-center px-1 mb-2" title={`${credits.generations_remaining} AI left today`}>
        <small className="text-secondary d-block">{credits.generations_remaining}</small>
        <small className="text-secondary">AI</small>
      </div>
    );
  }

  return (
    <div className="px-2 mb-3">
      <small className="text-secondary d-block mb-1">AI Credits Today</small>
      <div className="d-flex justify-content-between small mb-1">
        <span>{credits.generations_today} / {credits.daily_limit}</span>
        <span>{credits.generations_remaining} left</span>
      </div>
      <ProgressBar now={dailyPct} variant={dailyPct >= 90 ? 'danger' : 'primary'} style={{ height: 6 }} />

      <small className="text-secondary d-block mt-2 mb-1">Products This Month</small>
      <div className="d-flex justify-content-between small mb-1">
        <span>{credits.products_this_month} / {credits.monthly_product_limit}</span>
        <span>{credits.products_remaining} left</span>
      </div>
      <ProgressBar now={monthlyPct} variant={monthlyPct >= 90 ? 'warning' : 'info'} style={{ height: 6 }} />

      {(dailyPct >= 80 || monthlyPct >= 80) && (
        <Link to="/pricing" className="d-block mt-2">
          <Button variant="outline-primary" size="sm" className="w-100">
            Upgrade to Pro
          </Button>
        </Link>
      )}
    </div>
  );
}
