// Assign: send an approved pack to one or more teams with a due date (spec §3).
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api/client'
import { useAssign, usePacks, useUsers } from '../api/hooks'
import { formatDate, inDaysIso, todayIso } from './format'
import { Empty, ErrorNote, Loading, PageHead } from './ui'

export function Assign() {
  const packs = usePacks()
  const users = useUsers()
  const assign = useAssign()
  const [params] = useSearchParams()
  const approved = useMemo(() => packs.data?.filter((p) => p.status === 'approved') ?? [], [packs.data])
  const teams = useMemo(
    () => ['Everyone', ...new Set((users.data ?? []).filter((u) => u.role === 'employee').map((u) => u.team))],
    [users.data],
  )

  const [packId, setPackId] = useState<number | null>(Number(params.get('pack')) || null)
  const [chosen, setChosen] = useState<string[]>([])
  const [due, setDue] = useState(inDaysIso(7))
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const selected = approved.find((p) => p.id === packId) ?? approved[0]
  const toggle = (t: string) => setChosen((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]))

  async function submit() {
    if (!selected || !chosen.length) return
    if (due < todayIso()) return setError('Pick a due date from today onwards.')
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      // One assignment per team (POST /api/assignments takes a single team)
      for (const team of chosen.slice(0, -1)) await api.assign({ pack_id: selected.id, team, due_date: due })
      await assign.mutateAsync({ pack_id: selected.id, team: chosen[chosen.length - 1], due_date: due })
      setDone(`Assigned “${selected.title}” to ${chosen.join(', ')}, due ${formatDate(due)}.`)
      setChosen([])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const all = approved.flatMap((p) => p.assignments.map((a) => ({ ...a, title: p.title }))).sort((a, b) => a.due_date.localeCompare(b.due_date))

  return (
    <>
      <PageHead title="Assign" sub="Choose an approved pack, the teams who should play it, and when it’s due." />
      {(packs.isPending || users.isPending) && <Loading />}
      <ErrorNote error={packs.error ?? users.error} />

      {packs.data && approved.length === 0 && (
        <section className="card">
          <Empty>
            No approved packs yet. <Link to="/admin/packs">Review and approve a pack</Link> first.
          </Empty>
        </section>
      )}

      {selected && (
        <form
          className="card assign-form"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="field">
            <label htmlFor="assign-pack">Pack</label>
            <select id="assign-pack" value={selected.id} onChange={(e) => setPackId(Number(e.target.value))}>
              {approved.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {p.question_count} questions
                </option>
              ))}
            </select>
          </div>
          <fieldset className="field">
            <legend>Teams</legend>
            <div className="team-picks">
              {teams.map((t) => (
                <label key={t} className={chosen.includes(t) ? 'team-pick on' : 'team-pick'}>
                  <input type="checkbox" checked={chosen.includes(t)} onChange={() => toggle(t)} />
                  {t}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="assign-due">Due date</label>
            <input id="assign-due" type="date" value={due} min={todayIso()} onChange={(e) => setDue(e.target.value)} required />
          </div>
          {error && (
            <p className="alert bad" role="alert">
              {error}
            </p>
          )}
          {done && (
            <p className="alert good" role="status">
              {done}
            </p>
          )}
          <div className="row">
            <button type="submit" className="btn accent" disabled={busy || !chosen.length}>
              {busy ? 'Assigning…' : chosen.length ? `Assign to ${chosen.length} ${chosen.length === 1 ? 'team' : 'teams'}` : 'Pick at least one team'}
            </button>
          </div>
        </form>
      )}

      {packs.data && (
        <section className="card">
          <h2>Current assignments</h2>
          {all.length === 0 ? (
            <Empty>Nothing assigned yet.</Empty>
          ) : (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Pack</th>
                    <th scope="col">Team</th>
                    <th scope="col">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((a) => (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td>{a.team}</td>
                      <td className="num">
                        {formatDate(a.due_date)}
                        {a.due_date < todayIso() && <span className="chip bad"> Overdue</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  )
}
