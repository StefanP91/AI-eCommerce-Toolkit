export function BulkProgressBar({
  current,
  total,
  percent,
  succeeded,
  failed,
  label,
}: {
  current: number;
  total: number;
  percent: number;
  succeeded: number;
  failed: number;
  label: string;
}) {
  return (
    <div className="dashboard-bulk-progress" role="status" aria-live="polite">
      <div className="dashboard-bulk-progress-top">
        <span>{label}</span>
        <strong>{percent}%</strong>
      </div>
      <div className="dashboard-bulk-progress-track">
        <div
          className="dashboard-bulk-progress-fill"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="dashboard-bulk-progress-meta">
        <span>
          {current}/{total} processed
        </span>
        <span>
          {succeeded} ok · {failed} failed
        </span>
      </div>
    </div>
  );
}
