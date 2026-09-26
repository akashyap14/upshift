// Pack review: check every question against its source, edit, regenerate, then approve (spec §3).
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useApprove, useDeletePack, useDeleteQuestion, useEditQuestion, usePack, useRegenerateQuestion } from '../api/hooks'
import type { ReviewQuestion } from '../api/types'
import { levelName, professionName } from './format'
import { Chip, ErrorNote, Loading, PageHead } from './ui'

const KEYS = ['A', 'B', 'C']

export function PackReview() {
  const id = Number(useParams().id)
  const pack = usePack(id)
  const approve = useApprove()
  const deletePack = useDeletePack()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<number | null>(null)

  if (pack.isPending) return <Loading />
  if (pack.isError)
    return (
      <>
        <Link to="/admin/packs" className="back">
          ← Packs
        </Link>
        <ErrorNote error={pack.error} />
      </>
    )

  const p = pack.data
  const bad = p.questions.filter((q) => !q.verified).length
  const blocked = bad > 0 || p.questions.length === 0

  function removePack() {
    if (confirm(`Delete the pack “${p.title}”? Answers to it will no longer count.`))
      deletePack.mutate(p.id, { onSuccess: () => navigate('/admin/packs') })
  }

  return (
    <>
      <Link to="/admin/packs" className="back">
        ← Packs
      </Link>
      <PageHead
        title={p.title}
        sub={
          <>
            {p.document_title ? `From “${p.document_title}” · ` : ''}
            {professionName(p.profession)} · {levelName(p.level)} · {p.questions.length} questions ·{' '}
            <Chip tone={p.status === 'approved' ? 'good' : 'warn'}>{p.status === 'approved' ? '✓ Approved' : 'Draft'}</Chip>
          </>
        }
      >
        {p.status === 'draft' && (
          <button type="button" className="btn accent" disabled={blocked || approve.isPending} onClick={() => approve.mutate(p.id)}>
            {approve.isPending ? 'Approving…' : 'Approve pack'}
          </button>
        )}
        {p.status === 'approved' && (
          <Link to={`/admin/assign?pack=${p.id}`} className="btn accent">
            Assign this pack
          </Link>
        )}
        <button type="button" className="btn danger" onClick={removePack} disabled={deletePack.isPending}>
          Delete pack
        </button>
      </PageHead>

      {p.status === 'draft' && bad > 0 && (
        <p className="alert warn" role="status">
          Fix {bad} unverified {bad === 1 ? 'question' : 'questions'} first. Each quote must appear word for word in the document; edit the quote,
          regenerate the question or delete it.
        </p>
      )}
      {p.status === 'draft' && p.questions.length === 0 && <p className="alert warn">This pack has no questions left. Delete it or generate a new one.</p>}
      <ErrorNote error={approve.error ?? deletePack.error} />
      {approve.isSuccess && p.status === 'approved' && (
        <p className="alert good" role="status">
          Approved. <Link to={`/admin/assign?pack=${p.id}`}>Assign it to a team</Link> so it shows up on their phones.
        </p>
      )}
      {p.assignments.length > 0 && (
        <p className="muted small">
          Assigned to {p.assignments.map((a) => `${a.team} (due ${a.due_date})`).join(', ')}
        </p>
      )}

      <div className="qlist">
        {p.questions.map((q, n) =>
          editing === q.id ? (
            <EditQuestion key={q.id} q={q} n={n} done={() => setEditing(null)} />
          ) : (
            <QuestionCard key={q.id} q={q} n={n} onEdit={() => setEditing(q.id)} />
          ),
        )}
      </div>
    </>
  )
}

function QuestionCard({ q, n, onEdit }: { q: ReviewQuestion; n: number; onEdit(): void }) {
  const del = useDeleteQuestion()
  const regen = useRegenerateQuestion()
  const busy = del.isPending || regen.isPending
  return (
    <article className={q.verified ? 'qcard' : 'qcard unverified'} aria-busy={regen.isPending}>
      <div className="qmeta">
        <b>Q{n + 1}</b>
        <Chip>{q.type === 'ai_move' ? 'AI Move' : 'Decide'}</Chip>
        <span className="grow" />
        <Chip tone={q.verified ? 'good' : 'bad'}>{q.verified ? 'Verified ✓' : 'Not verified ✗'}</Chip>
      </div>
      <p className="scenario">{q.scenario}</p>
      <p className="qtext">{q.question}</p>
      <ol className="opts-r">
        {q.options.map((o, k) => (
          <li key={k} className={k === q.best ? 'best' : k === q.second_best ? 'second' : undefined}>
            <span className="k">{KEYS[k]}</span>
            <span className="grow">{o}</span>
            {k === q.best && <span className="tag good">✓ Best</span>}
            {k === q.second_best && <span className="tag">Also reasonable</span>}
          </li>
        ))}
      </ol>
      <p className="small">
        <b>Why:</b> {q.why}
      </p>
      {q.open_question && (
        <p className="small">
          <b>Open question:</b> {q.open_question}
        </p>
      )}
      <blockquote className={q.verified ? 'quote' : 'quote bad'}>
        “{q.source_quote}” <span className="muted">— {q.source_location || 'no location'}</span>
        {!q.verified && <span className="quote-note">This quote wasn’t found word for word in the document.</span>}
      </blockquote>
      <ErrorNote error={del.error ?? regen.error} />
      <div className="row">
        <button type="button" className="btn" onClick={onEdit} disabled={busy}>
          Edit
        </button>
        <button type="button" className="btn" onClick={() => regen.mutate(q.id)} disabled={busy}>
          {regen.isPending ? (
            <>
              <span className="spin" aria-hidden="true" /> Regenerating…
            </>
          ) : (
            'Regenerate'
          )}
        </button>
        <button
          type="button"
          className="btn danger"
          disabled={busy}
          onClick={() => confirm(`Delete question ${n + 1}?`) && del.mutate(q.id)}
        >
          Delete
        </button>
      </div>
    </article>
  )
}

function EditQuestion({ q, n, done }: { q: ReviewQuestion; n: number; done(): void }) {
  const edit = useEditQuestion()
  const [f, setF] = useState(q)
  const [result, setResult] = useState<boolean | null>(null)
  const set = <K extends keyof ReviewQuestion>(k: K, v: ReviewQuestion[K]) => setF((x) => ({ ...x, [k]: v }))
  const id = (k: string) => `q${q.id}-${k}`

  function save() {
    edit.mutate(
      {
        id: q.id,
        body: {
          scenario: f.scenario,
          question: f.question,
          options: f.options,
          best: f.best,
          second_best: f.second_best === f.best ? null : f.second_best,
          why: f.why,
          source_quote: f.source_quote,
          source_location: f.source_location,
          open_question: f.type === 'ai_move' ? f.open_question || null : null,
        },
      },
      {
        onSuccess: (saved) => {
          const verified = (saved as ReviewQuestion).verified
          setResult(verified)
          if (verified) done()
        },
      },
    )
  }

  return (
    <form
      className="qcard editing"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <div className="qmeta">
        <b>Editing Q{n + 1}</b>
        <span className="grow" />
        <Chip tone={q.verified ? 'good' : 'bad'}>{q.verified ? 'Verified ✓' : 'Not verified ✗'}</Chip>
      </div>
      <div className="field">
        <label htmlFor={id('scn')}>Scenario (read aloud, up to 60 words)</label>
        <textarea id={id('scn')} value={f.scenario} onChange={(e) => set('scenario', e.target.value)} rows={3} required />
      </div>
      <div className="field">
        <label htmlFor={id('q')}>Question</label>
        <input id={id('q')} type="text" value={f.question} onChange={(e) => set('question', e.target.value)} required />
      </div>
      <fieldset className="field">
        <legend>Options (pick the best one)</legend>
        {f.options.map((o, k) => (
          <div key={k} className="opt-edit">
            <label className="radio">
              <input type="radio" name={id('best')} checked={f.best === k} onChange={() => set('best', k as 0 | 1 | 2)} />
              <span>Best</span>
            </label>
            <span className="k">{KEYS[k]}</span>
            <input
              type="text"
              aria-label={`Option ${KEYS[k]}`}
              value={o}
              required
              onChange={(e) => {
                const opts = [...f.options] as ReviewQuestion['options']
                opts[k] = e.target.value
                set('options', opts)
              }}
            />
          </div>
        ))}
      </fieldset>
      <div className="field-row">
        <div className="field">
          <label htmlFor={id('second')}>Second best (worth 5 points at Mid and Leader)</label>
          <select
            id={id('second')}
            value={f.second_best ?? ''}
            onChange={(e) => set('second_best', e.target.value === '' ? null : (Number(e.target.value) as 0 | 1 | 2))}
          >
            <option value="">None</option>
            {KEYS.map((k, i) =>
              i === f.best ? null : (
                <option key={k} value={i}>
                  {k}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="field grow">
          <label htmlFor={id('why')}>Why (up to 2 sentences)</label>
          <input id={id('why')} type="text" value={f.why} onChange={(e) => set('why', e.target.value)} required />
        </div>
      </div>
      <div className="field">
        <label htmlFor={id('quote')}>Quote from the document (must match word for word)</label>
        <textarea id={id('quote')} value={f.source_quote} onChange={(e) => set('source_quote', e.target.value)} rows={2} required />
      </div>
      <div className="field">
        <label htmlFor={id('loc')}>Where it is (page or heading)</label>
        <input id={id('loc')} type="text" value={f.source_location} onChange={(e) => set('source_location', e.target.value)} />
      </div>
      {f.type === 'ai_move' && (
        <div className="field">
          <label htmlFor={id('open')}>Open question (one line, answerable in 20 seconds)</label>
          <input id={id('open')} type="text" value={f.open_question ?? ''} onChange={(e) => set('open_question', e.target.value)} />
        </div>
      )}
      <ErrorNote error={edit.error} />
      {result === false && (
        <p className="alert bad" role="alert">
          Saved, but the quote still isn’t in the document word for word. Copy it exactly from the source.
        </p>
      )}
      <div className="row">
        <button type="submit" className="btn primary" disabled={edit.isPending}>
          {edit.isPending ? 'Saving…' : 'Save and re-check'}
        </button>
        <button type="button" className="btn" onClick={done}>
          {result === false ? 'Close' : 'Cancel'}
        </button>
      </div>
    </form>
  )
}
