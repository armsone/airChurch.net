type SourceEntry = {
  name: string;
  homepage: string;
  url: string;
  linkLabel: string;
  checkedLabel?: string;
  statusLabel?: string;
};

export default function SourceDirectory({ title, note, groups }: {
  title: string;
  note?: string;
  groups: Array<{ label: string; sources: SourceEntry[] }>;
}) {
  const populated = groups.filter(group => group.sources.length > 0);
  return <details className="source-directory">
    <summary>{title} · {populated.reduce((total, group) => total + group.sources.length, 0)}곳</summary>
    {note && <p className="source-directory-note">{note}</p>}
    <div className="source-directory-groups">{populated.map(group => <section className="source-directory-group" key={group.label}>
      <h3>{group.label}<small>{group.sources.length}곳 · 가나다순</small></h3>
      <ul>{[...group.sources].sort((a, b) => a.name.localeCompare(b.name, "ko-KR")).map(source => <li key={source.url}>
        <strong>{source.name}</strong>
        <div className="source-directory-links"><a href={source.homepage} target="_blank" rel="noopener noreferrer">홈페이지 ↗</a><a href={source.url} target="_blank" rel="noopener noreferrer">{source.linkLabel} ↗</a></div>
        {source.checkedLabel && <small className="source-directory-checked">{source.checkedLabel}</small>}
        {source.statusLabel && <small className="source-directory-status">{source.statusLabel}</small>}
      </li>)}</ul>
    </section>)}</div>
  </details>;
}
