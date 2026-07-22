import { useCallback, useEffect, useRef, useState } from "react";
import type { useFetcher } from "react-router";

export type BulkProgressState = {
  current: number;
  total: number;
  percent: number;
  succeeded: number;
  failed: number;
  label: string;
};

type BulkJob = {
  ids: string[];
  index: number;
  succeeded: number;
  failed: number;
  runId: string;
  label: string;
  buildFormData: (id: string) => FormData;
};

type BulkFetcherData = {
  intent?: string;
  ok?: boolean;
  succeeded?: number;
  failed?: number;
  error?: string;
};

function itemSucceeded(data: BulkFetcherData): boolean {
  if (typeof data.succeeded === "number") {
    return data.succeeded > 0;
  }
  return Boolean(data.ok);
}

export function useSequentialBulk<TData extends BulkFetcherData>(options: {
  fetcher: ReturnType<typeof useFetcher<TData>>;
  bulkIntents: string[];
  onComplete: (result: {
    succeeded: number;
    failed: number;
    total: number;
    label: string;
  }) => void;
}) {
  const { fetcher, bulkIntents, onComplete } = options;
  const jobRef = useRef<BulkJob | null>(null);
  const handledKeyRef = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  const [progress, setProgress] = useState<BulkProgressState | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const submitCurrent = useCallback(
    (job: BulkJob) => {
      fetcher.submit(job.buildFormData(job.ids[job.index]), { method: "post" });
    },
    [fetcher],
  );

  const startBulk = useCallback(
    (input: {
      ids: string[];
      label: string;
      buildFormData: (id: string) => FormData;
    }) => {
      if (input.ids.length === 0 || jobRef.current) return;

      const job: BulkJob = {
        ids: input.ids,
        index: 0,
        succeeded: 0,
        failed: 0,
        runId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: input.label,
        buildFormData: input.buildFormData,
      };

      jobRef.current = job;
      handledKeyRef.current = null;
      setProgress({
        current: 0,
        total: job.ids.length,
        percent: 0,
        succeeded: 0,
        failed: 0,
        label: job.label,
      });
      submitCurrent(job);
    },
    [submitCurrent],
  );

  useEffect(() => {
    const job = jobRef.current;
    if (!job || fetcher.state !== "idle" || !fetcher.data) return;

    const intent = fetcher.data.intent;
    if (!intent || !bulkIntents.includes(intent)) return;

    const handledKey = `${job.runId}:${job.index}:${JSON.stringify(fetcher.data)}`;
    if (handledKeyRef.current === handledKey) return;
    handledKeyRef.current = handledKey;

    if (itemSucceeded(fetcher.data)) {
      job.succeeded += 1;
    } else {
      job.failed += 1;
    }

    job.index += 1;
    const percent = Math.round((job.index / job.ids.length) * 100);

    setProgress({
      current: job.index,
      total: job.ids.length,
      percent,
      succeeded: job.succeeded,
      failed: job.failed,
      label: job.label,
    });

    if (job.index >= job.ids.length) {
      const result = {
        succeeded: job.succeeded,
        failed: job.failed,
        total: job.ids.length,
        label: job.label,
      };
      jobRef.current = null;
      onCompleteRef.current(result);
      window.setTimeout(() => setProgress(null), 1800);
      return;
    }

    submitCurrent(job);
  }, [fetcher.state, fetcher.data, bulkIntents, submitCurrent]);

  return {
    progress,
    startBulk,
    isBulkRunning: progress !== null,
  };
}
