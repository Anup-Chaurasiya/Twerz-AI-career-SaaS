export default function MarketingLoading() {
  return (
    <div className="mkt-content mkt-loading" aria-busy="true" aria-label="Loading page">
      <div className="mkt-loading-title" />
      <div className="mkt-loading-subtitle" />
      <div className="mkt-loading-grid">
        <div className="mkt-loading-card" />
        <div className="mkt-loading-card" />
        <div className="mkt-loading-card" />
      </div>
    </div>
  );
}
