export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="page">
      <header className="page-head">
        <h1>{title}</h1>
      </header>
      <div className="card coming">
        <strong>In arrivo</strong>
        <p className="muted">{text}</p>
      </div>
    </div>
  );
}
