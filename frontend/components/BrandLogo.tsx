import Image from 'next/image';
import Link from 'next/link';

type BrandLogoProps = {
  onClick?: () => void;
  className?: string;
};

export default function BrandLogo({ onClick, className = 'brand-logo' }: BrandLogoProps) {
  return (
    <Link href="/" className={className} onClick={onClick}>
      <Image
        src="/twerz-logo.png"
        alt="Twerz"
        width={38}
        height={38}
        className="brand-logo-img"
        priority
      />
      <div className="brand-logo-text">
        <span className="brand-logo-name">Twerz</span>
        <span className="brand-logo-by">resume.twerz</span>
      </div>
    </Link>
  );
}

export function LoveIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      className="lp-footer-love-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}
