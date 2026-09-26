// Leaders' dashboard (spec §3): headline tiles, scores, weakest questions, leaderboard, completion.
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useDashboard } from '../api/hooks'
import type { Tile } from '../api/types'
import { formatDate } from './format'
import { Empty, ErrorNote, Loading, PageHead } from './ui'

function Change({ tile, unit = '' }: { tile: Tile; unit?: string }) {
  const diff = tile.value - tile.previous
  if (diff === 0) return <span className="change same">No change vs last week</span>
  const up = diff > 0
  return (
    <span className={up ? 'change up' : 'change down'}>
      {up ? '▲' : '▼'} {Math.abs(diff).toLocaleString('en-IN')}
      {unit} {up ? 'more' : 'less'} than last week
    </span>
  )
}

function TileCard({ label, tile, unit = '' }: { label: string; tile: Tile; unit?: string }) {
  return (
    <div className="tile">
      <div className="v num">
        {tile.value.toLocaleString('en-IN')}
        {unit}
      </div>
      <div className="l">{label}</div>
      <Change tile={tile} unit={unit === '%' ? ' pts' : ''} />
    </div>
  )
}

// Recharts renders SVG, so colours come from CSS variables resolved in the stylesheet.
function ScoreChart({ data, dataKey }: { data: { score: number }[]; dataKey: string }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={dataKey} tickLine={false} axisLine={false} interval={0} tick={{ className: 'tick' }} />
          <YAxis domain={[0, 100]} unit="%" width={48} tickLine={false} axisLine={false} tick={{ className: 'tick' }} />
          <Tooltip cursor={{ className: 'cursor' }} formatter={(v) => [`${v}%`, 'Average score']} wrapperClassName="tooltip" />
          <Bar dataKey="score" className="bar-fill" radius={[8, 8, 0, 0]} maxBarSize={64} isAnimationActive={false}>
            <LabelList dataKey="score" position="top" formatter={(v) => `${v}%`} className="bar-label" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Dashboard({ companyId }: { companyId: number }) {
  const dash = useDashboard(companyId)

  if (dash.isPending) return <Loading label="Loading the dashboard…" />
  if (dash.isError) return <ErrorNote error={dash.error} />
  const d = dash.data
  const t = d.tiles

  return (
    <>
      <PageHead title="Dashboard" sub="How your teams are doing on your own material. Updates every 15 seconds." />

      <div className="tiles">
        <TileCard label="Active players this week" tile={t.active_players} />
        <TileCard label="Sessions completed" tile={t.sessions_completed} />
        <TileCard label="Average score" tile={t.avg_score} unit="%" />
        <TileCard label="Points earned" tile={t.points_earned} />
      </div>

      <div className="grid2">
        <section className="card">
          <h2>Score by team</h2>
          {d.score_by_team.length ? <ScoreChart data={d.score_by_team} dataKey="team" /> : <Empty>No answers yet.</Empty>}
        </section>
        <section className="card">
          <h2>Score by pack</h2>
          {d.score_by_pack.length ? <ScoreChart data={d.score_by_pack} dataKey="title" /> : <Empty>No answers on company packs yet.</Empty>}
        </section>

        <section className="card">
          <h2>Weakest questions</h2>
          <p className="muted small">The most-missed questions are the real skill gaps.</p>
          {d.weakest.length === 0 ? (
            <Empty>No answers yet.</Empty>
          ) : (
            <ol className="weak">
              {d.weakest.map((w) => (
                <li key={w.question_id}>
                  <div className="grow">
                    <b>{w.question}</b>
                    <div className="muted small">
                      {w.pack_title} · {w.answers} {w.answers === 1 ? 'answer' : 'answers'}
                    </div>
                  </div>
                  <span className={w.miss_rate >= 50 ? 'chip bad' : 'chip warn'}>{w.miss_rate}% missed</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card">
          <h2>Leaderboard</h2>
          <p className="muted small">Top 10 by points. Players can opt out in the app.</p>
          {d.leaderboard.length === 0 ? (
            <Empty>No players yet.</Empty>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col" className="num">
                    #
                  </th>
                  <th scope="col">Name</th>
                  <th scope="col">Team</th>
                  <th scope="col" className="num right">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.leaderboard.map((l, i) => (
                  <tr key={l.user_id}>
                    <td className="num">{i + 1}</td>
                    <td>{l.name}</td>
                    <td className="muted">{l.team}</td>
                    <td className="num right">
                      <b>{l.points.toLocaleString('en-IN')}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Completion by assignment</h2>
        <div className="legend" aria-hidden="true">
          <span>
            <i className="seg-done" /> Done
          </span>
          <span>
            <i className="seg-prog" /> In progress
          </span>
          <span>
            <i className="seg-none" /> Not started
          </span>
        </div>
        {d.completion.length === 0 ? (
          <Empty>Assign a pack to see completion.</Empty>
        ) : (
          <div className="scroll-x">
            <table className="completion">
              <thead>
                <tr>
                  <th scope="col">Pack</th>
                  <th scope="col">Team</th>
                  <th scope="col">Due</th>
                  <th scope="col">Progress</th>
                </tr>
              </thead>
              <tbody>
                {d.completion.map((c) => {
                  const total = c.done + c.in_progress + c.not_started
                  const pct = (n: number) => (total ? (n / total) * 100 : 0)
                  return (
                    <tr key={c.assignment_id}>
                      <td>{c.pack_title}</td>
                      <td>{c.team}</td>
                      <td className="num">{formatDate(c.due_date)}</td>
                      <td className="progress-cell">
                        <div className="stack" aria-hidden="true">
                          <i className="seg-done" style={{ width: `${pct(c.done)}%` }} />
                          <i className="seg-prog" style={{ width: `${pct(c.in_progress)}%` }} />
                          <i className="seg-none" style={{ width: `${pct(c.not_started)}%` }} />
                        </div>
                        <span className="small">
                          {c.done} done · {c.in_progress} in progress · {c.not_started} not started
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
