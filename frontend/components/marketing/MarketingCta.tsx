import Link from 'next/link';

type MarketingCtaProps = {
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
};

export default function MarketingCta({ primary, secondary }: MarketingCtaProps) {
  return (
    <div className="mkt-cta-row">
      <Link href={primary.href} className="mkt-btn-primary">
        {primary.label}
      </Link>
      {secondary ? (
        <Link href={secondary.href} className="mkt-btn-secondary">
          {secondary.label}
        </Link>
      ) : null}
    </div>
  );
}
