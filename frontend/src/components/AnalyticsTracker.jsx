import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initAnalytics, trackPageView } from '../utils/analytics';

export default function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    trackPageView(path);
  }, [location.pathname, location.search]);

  return null;
}
