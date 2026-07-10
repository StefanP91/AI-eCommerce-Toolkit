const MAX_BATCH_RETRIES = 3;
const BATCH_RETRY_DELAY_MS = 4000;

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isRetryableScanError(err) {
  if (!err.response) {
    return true;
  }

  const status = err.response.status;

  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

export function formatScanEta(etaMs) {
  if (etaMs === null || etaMs === undefined || !Number.isFinite(etaMs) || etaMs < 0) {
    return 'Calculating ETA...';
  }

  const totalSeconds = Math.max(1, Math.ceil(etaMs / 1000));

  if (totalSeconds < 60) {
    return `~${totalSeconds}s remaining`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return seconds > 0 ? `~${minutes}m ${seconds}s remaining` : `~${minutes}m remaining`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `~${hours}h ${remainingMinutes}m remaining`
    : `~${hours}h remaining`;
}

export function getScanProgressPercent(scanned, total) {
  if (!total || total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((scanned / total) * 100));
}

/**
 * Run a full store SEO scan in batches until every catalog product is audited.
 */
export async function runFullStoreScan({
  api,
  visitorPassword = '',
  resume = false,
  onProgress,
}) {
  const passwordPayload = visitorPassword.trim()
    ? { visitor_password: visitorPassword.trim() }
    : {};

  const requestBatch = async (append) => {
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_BATCH_RETRIES; attempt += 1) {
      try {
        const response = await api.post('/store/scan', {
          ...passwordPayload,
          append,
        }, { timeout: 600000 });

        return response.data.store;
      } catch (err) {
        lastError = err;

        if (!isRetryableScanError(err) || attempt === MAX_BATCH_RETRIES) {
          throw err;
        }

        await sleep(BATCH_RETRY_DELAY_MS * attempt);
      }
    }

    throw lastError;
  };

  const startedAt = Date.now();
  let store;

  const report = (storeData, phase) => {
    const scanned = storeData.product_count ?? 0;
    const total = storeData.catalog_product_count ?? scanned;
    const elapsed = Date.now() - startedAt;
    const perProduct = scanned > 0 ? elapsed / scanned : null;
    const etaMs = perProduct && total > scanned
      ? (total - scanned) * perProduct
      : null;

    onProgress?.({
      phase,
      scanned,
      total,
      etaMs,
      percent: getScanProgressPercent(scanned, total),
      store: storeData,
    });
  };

  if (resume) {
    store = await requestBatch(true);
    report(store, 'scanning');
  } else {
    onProgress?.({
      phase: 'starting',
      scanned: 0,
      total: 0,
      etaMs: null,
      percent: 0,
      store: null,
    });

    store = await requestBatch(false);
    report(store, 'scanning');
  }

  while (
    store.catalog_product_count > 0
    && store.product_count < store.catalog_product_count
  ) {
    store = await requestBatch(true);
    report(store, 'scanning');
  }

  onProgress?.({
    phase: 'complete',
    scanned: store.product_count ?? 0,
    total: store.catalog_product_count ?? store.product_count ?? 0,
    etaMs: 0,
    percent: 100,
    store,
  });

  return store;
}
