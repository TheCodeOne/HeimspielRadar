import * as React from 'react';
import { toQR } from 'toqr';

export interface MatchQrCodeProps {
  value: string;
  size?: number;
  className?: string;
  fgColor?: string;
  bgColor?: string;
}

/**
 * Clean SVG QR Code generated using `toqr`.
 * Renders sharply at any scale without external network requests or canvas dependencies.
 */
export const MatchQrCode: React.FC<MatchQrCodeProps> = ({
  value,
  size = 140,
  className = '',
  fgColor = '#0f172a',
  bgColor = '#ffffff',
}) => {
  const qrData = React.useMemo(() => {
    try {
      const bitArray = toQR(value);
      const dimension = Math.round(Math.sqrt(bitArray.length));

      return { bitArray, dimension };
    } catch {
      return null;
    }
  }, [value]);

  if (!qrData || qrData.dimension === 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-xl bg-white text-[10px] text-muted-foreground ${className}`}
      >
        QR ungültig
      </div>
    );
  }

  const { bitArray, dimension } = qrData;
  const quietZone = 2; // quiet zone in module units
  const totalDimension = dimension + quietZone * 2;

  // Build SVG path for dark modules
  let path = '';

  for (let r = 0; r < dimension; r++) {
    for (let c = 0; c < dimension; c++) {
      if (bitArray[r * dimension + c] === 1) {
        const x = c + quietZone;
        const y = r + quietZone;
        path += `M${x},${y}h1v1h-1z `;
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${totalDimension} ${totalDimension}`}
      width={size}
      height={size}
      className={`rounded-xl shadow-xs shrink-0 select-none ${className}`}
      role="img"
      aria-label={`QR Code für ${value}`}
    >
      <rect
        width={totalDimension}
        height={totalDimension}
        fill={bgColor}
        rx="2"
      />
      <path d={path} fill={fgColor} />
    </svg>
  );
};
