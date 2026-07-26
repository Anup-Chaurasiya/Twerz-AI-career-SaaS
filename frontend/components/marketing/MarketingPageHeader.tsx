type MarketingPageHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function MarketingPageHeader({ title, subtitle }: MarketingPageHeaderProps) {
  return (
    <header className="mkt-hero">
      <h1 className="mkt-title">{title}</h1>
      {subtitle ? <p className="mkt-subtitle">{subtitle}</p> : null}
    </header>
  );
}
