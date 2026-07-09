import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/client';

const SESSION_KEY = 'tracked_paths';

function getTrackedPaths() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]');
  } catch {
    return [];
  }
}

function markTracked(path) {
  const paths = getTrackedPaths();
  if (!paths.includes(path)) {
    paths.push(path);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(paths));
  }
}

function wasTracked(path) {
  return getTrackedPaths().includes(path);
}

export default function PageVisitTracker() {
  const location = useLocation();
  const lastPath = useRef('');

  useEffect(() => {
    const path = location.pathname;
    if (path === lastPath.current || wasTracked(path)) {
      return;
    }

    lastPath.current = path;
    markTracked(path);

    api.post('/analytics/visit', { path }).catch(() => {});
  }, [location.pathname]);

  return null;
}
