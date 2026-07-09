export default function BrandLogo({
  variant = 'dark',
  className = '',
  showText = true,
}) {
  if (!showText) {
    return (
      <img
        src="/favicon.png"
        alt="AI Commerce Suite"
        className={`brand-logo-icon-only ${className}`.trim()}
      />
    );
  }

  const src = variant === 'light' ? '/logo-horizontal.png' : '/logo-horizontal-light.png';

  return (
    <img
      src={src}
      alt="AI Commerce Suite"
      className={`brand-logo-image ${className}`.trim()}
    />
  );
}
