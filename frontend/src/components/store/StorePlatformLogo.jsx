import { useState } from 'react';
import { getStorePlatform } from '../../constants/storePlatforms';

export default function StorePlatformLogo({ platformId, size = 40, className = '' }) {
  const platform = getStorePlatform(platformId);
  const [failed, setFailed] = useState(false);

  if (!platform || failed) {
    const label = platform?.label?.charAt(0) ?? '?';

    return (
      <div
        className={`rounded d-flex align-items-center justify-content-center fw-bold text-white ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: platform ? `#${platform.brandColor}` : '#6c757d',
          fontSize: Math.max(12, size * 0.4),
        }}
        aria-hidden="true"
      >
        {label}
      </div>
    );
  }

  return (
    <img
      src={`https://cdn.simpleicons.org/${platform.logoSlug}/${platform.brandColor}`}
      alt=""
      width={size}
      height={size}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
