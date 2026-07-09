export default function SeoScore({ score, checks }) {
  const getScoreColor = (s) => {
    if (s >= 90) return '#28a745';
    if (s >= 70) return '#ffc107';
    return '#dc3545';
  };

  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-body">
        <div className="d-flex align-items-center gap-4 mb-4">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
            style={{
              width: 80,
              height: 80,
              backgroundColor: getScoreColor(score),
              fontSize: '1.5rem',
            }}
          >
            {score}
          </div>
          <div>
            <h5 className="mb-1">SEO Score</h5>
            <p className="text-muted mb-0">{score} / 100</p>
          </div>
        </div>

        <div className="row g-2">
          {checks && Object.entries(checks).map(([key, check]) => (
            <div key={key} className="col-md-6">
              <div
                className={`d-flex align-items-center gap-2 p-2 rounded ${
                  check.passed ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'
                }`}
              >
                <span>{check.passed ? '✔' : '✖'}</span>
                <div>
                  <small className="fw-semibold d-block">{check.label}</small>
                  <small className="text-muted">{check.message}</small>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
