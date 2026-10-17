import Link from 'next/link';

type Props = {
  page: number;
  totalPages: number;
  label: string;
} & ({ hrefFor: (page: number) => string; onChange?: never } | { onChange: (page: number) => void; hrefFor?: never });

/** Previous/next controls, as links (server-rendered lists) or buttons (lists loaded on the client). */
export function Pagination({ page, totalPages, label, hrefFor, onChange }: Props) {
  if (totalPages <= 1) return null;
  const control = (target: number, text: string) => {
    const disabled = target < 1 || target > totalPages;
    if (disabled) return <span className="pagination-button" aria-disabled="true">{text}</span>;
    return hrefFor
      ? <Link className="pagination-button" href={hrefFor(target)} scroll={false}>{text}</Link>
      : <button type="button" className="pagination-button" onClick={() => onChange?.(target)}>{text}</button>;
  };
  return <nav className="pagination" aria-label={label}>
    {control(page - 1, 'Anterior')}
    <span className="pagination-status">Página {page} de {totalPages}</span>
    {control(page + 1, 'Siguiente')}
  </nav>;
}
