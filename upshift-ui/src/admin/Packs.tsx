// Packs list: every company pack with its status, checks and assignments.
import { Link } from 'react-router'
import { usePacks } from '../api/hooks'
import { levelName, professionName } from './format'
import { Chip, Empty, ErrorNote, Loading, PageHead } from './ui'

export function Packs() {
  const packs = usePacks()
  return (
    <>
      <PageHead title="Packs" sub="Review, approve and assign. Only packs where every quote is verified can go live." />
      <section className="card">
        {packs.isPending && <Loading />}
        <ErrorNote error={packs.error} />
        {packs.data?.length === 0 && (
          <Empty>
            No packs yet. <Link to="/admin/documents">Generate one from a document</Link>.
          </Empty>
        )}
        {!!packs.data?.length && (
          <ul className="list">
            {packs.data.map((p) => (
              <li key={p.id} className="item">
                <div className="grow">
                  <Link to={`/admin/packs/${p.id}`} className="title-link">
                    {p.title}
                  </Link>
                  <div className="muted small">
                    {p.document_title ? `From “${p.document_title}” · ` : ''}
                    {professionName(p.profession)} · {levelName(p.level)} · {p.question_count} {p.question_count === 1 ? 'question' : 'questions'}
                    {p.assignments.length > 0 && ` · assigned to ${[...new Set(p.assignments.map((a) => a.team))].join(', ')}`}
                  </div>
                </div>
                {p.unverified_count > 0 && <Chip tone="bad">✗ {p.unverified_count} not verified</Chip>}
                <Chip tone={p.status === 'approved' ? 'good' : 'warn'}>{p.status === 'approved' ? '✓ Approved' : 'Draft'}</Chip>
                <Link to={`/admin/packs/${p.id}`} className="btn">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
