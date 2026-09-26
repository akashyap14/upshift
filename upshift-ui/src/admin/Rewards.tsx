// Rewards: manage the catalogue and see redemption history (spec §3).
import { useState } from 'react'
import { useCreateReward, useDeleteReward, useRedemptions, useRewards, useUpdateReward } from '../api/hooks'
import type { Reward, RewardInput, RewardKind } from '../api/types'
import { useSession } from '../api/session'
import { formatDate } from './format'
import { Chip, Empty, ErrorNote, Loading, PageHead } from './ui'

const KINDS: { value: RewardKind; label: string }[] = [
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'skill_upgrade', label: 'Skill upgrade' },
  { value: 'company', label: 'Company' },
]
const kindLabel = (k: RewardKind) => KINDS.find((x) => x.value === k)?.label ?? k
const BLANK: RewardInput = { title: '', kind: 'sponsor', cost_points: 100, sponsor_name: 'Demo partner', stock: 10 }

export function Rewards() {
  const { user } = useSession()
  // The catalogue comes from GET /api/rewards; the user id only adds a balance we don't need here.
  const rewards = useRewards(user!.id)
  const history = useRedemptions()
  const remove = useDeleteReward()
  const [editing, setEditing] = useState<Reward | 'new' | null>(null)

  return (
    <>
      <PageHead title="Rewards" sub="What players can redeem their points for.">
        {editing === null && (
          <button type="button" className="btn accent" onClick={() => setEditing('new')}>
            Add reward
          </button>
        )}
      </PageHead>
      <p className="alert warn">
        Sponsor rewards are labelled “Demo partner” until a real partner signs up. Don’t use a real brand name without its permission.
      </p>

      {editing !== null && <RewardForm reward={editing === 'new' ? null : editing} done={() => setEditing(null)} />}

      <section className="card">
        <h2>Catalogue</h2>
        {rewards.isPending && <Loading />}
        <ErrorNote error={rewards.error ?? remove.error} />
        {rewards.data?.rewards.length === 0 && <Empty>No rewards yet. Add one so players have something to aim for.</Empty>}
        {!!rewards.data?.rewards.length && (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th scope="col">Reward</th>
                  <th scope="col">Kind</th>
                  <th scope="col" className="right">
                    Cost
                  </th>
                  <th scope="col">Sponsor</th>
                  <th scope="col" className="right">
                    Stock
                  </th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rewards.data.rewards.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.title}</b>
                    </td>
                    <td>
                      <Chip>{kindLabel(r.kind)}</Chip>
                    </td>
                    <td className="num right">{r.cost_points.toLocaleString('en-IN')} pts</td>
                    <td className="muted">{r.sponsor_name ?? '—'}</td>
                    <td className="num right">{r.stock <= 0 ? <Chip tone="bad">Out of stock</Chip> : r.stock}</td>
                    <td className="actions">
                      <button type="button" className="btn" onClick={() => setEditing(r)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn danger"
                        disabled={remove.isPending}
                        onClick={() => confirm(`Remove “${r.title}” from the catalogue?`) && remove.mutate(r.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Redemption history</h2>
        {history.isPending && <Loading />}
        <ErrorNote error={history.error} />
        {history.data?.length === 0 && <Empty>No one has redeemed a reward yet.</Empty>}
        {!!history.data?.length && (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th scope="col">Who</th>
                  <th scope="col">Team</th>
                  <th scope="col">Reward</th>
                  <th scope="col" className="right">
                    Points
                  </th>
                  <th scope="col">Code</th>
                  <th scope="col">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((h) => (
                  <tr key={h.id}>
                    <td>{h.user_name}</td>
                    <td className="muted">{h.team}</td>
                    <td>{h.reward_title}</td>
                    <td className="num right">{h.cost_points.toLocaleString('en-IN')}</td>
                    <td>
                      <code>{h.code}</code>
                    </td>
                    <td className="num">{formatDate(h.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function RewardForm({ reward, done }: { reward: Reward | null; done(): void }) {
  const create = useCreateReward()
  const update = useUpdateReward()
  const [f, setF] = useState<RewardInput>(reward ? { title: reward.title, kind: reward.kind, cost_points: reward.cost_points, sponsor_name: reward.sponsor_name, stock: reward.stock } : BLANK)
  const pending = create.isPending || update.isPending

  function setKind(kind: RewardKind) {
    setF((x) => ({ ...x, kind, sponsor_name: kind === 'sponsor' ? x.sponsor_name || 'Demo partner' : null }))
  }

  function save() {
    const body = { ...f, title: f.title.trim(), sponsor_name: f.kind === 'sponsor' ? f.sponsor_name?.trim() || 'Demo partner' : null }
    if (reward) update.mutate({ id: reward.id, body }, { onSuccess: done })
    else create.mutate(body, { onSuccess: done })
  }

  return (
    <form
      className="card reward-form"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <h2>{reward ? `Edit “${reward.title}”` : 'Add a reward'}</h2>
      <div className="field-row">
        <div className="field grow">
          <label htmlFor="rw-title">Title</label>
          <input id="rw-title" type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="rw-kind">Kind</label>
          <select id="rw-kind" value={f.kind} onChange={(e) => setKind(e.target.value as RewardKind)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="rw-cost">Cost (points)</label>
          <input id="rw-cost" type="number" min={1} value={f.cost_points} onChange={(e) => setF({ ...f, cost_points: Number(e.target.value) })} required />
        </div>
        <div className="field">
          <label htmlFor="rw-stock">Stock</label>
          <input id="rw-stock" type="number" min={0} value={f.stock} onChange={(e) => setF({ ...f, stock: Number(e.target.value) })} required />
        </div>
        {f.kind === 'sponsor' && (
          <div className="field grow">
            <label htmlFor="rw-sponsor">Sponsor</label>
            <input id="rw-sponsor" type="text" value={f.sponsor_name ?? ''} onChange={(e) => setF({ ...f, sponsor_name: e.target.value })} />
          </div>
        )}
      </div>
      <ErrorNote error={create.error ?? update.error} />
      <div className="row">
        <button type="submit" className="btn primary" disabled={pending || !f.title.trim()}>
          {pending ? 'Saving…' : reward ? 'Save changes' : 'Add reward'}
        </button>
        <button type="button" className="btn" onClick={done}>
          Cancel
        </button>
      </div>
    </form>
  )
}
