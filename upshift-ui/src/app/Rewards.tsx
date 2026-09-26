// Rewards tab: balance, catalogue, redeem with a one-time code.
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useRedeem, useRewards } from '../api/hooks'
import { useSession } from '../api/session'
import type { RedeemResponse, Reward, RewardKind } from '../api/types'
import { useApp } from './context'

const GROUPS: { kind: RewardKind; title: string }[] = [
  { kind: 'sponsor', title: 'Treats' },
  { kind: 'skill_upgrade', title: 'Skill upgrades' },
  { kind: 'company', title: 'Company perks' },
]

export function Rewards() {
  const { user, signIn } = useSession()
  const { setRoad } = useApp()
  const rewards = useRewards(user!.id)
  const redeem = useRedeem()
  const [confirm, setConfirm] = useState<Reward | null>(null)
  const [code, setCode] = useState<RedeemResponse | null>(null)

  useEffect(() => setRoad(0.06), [setRoad])

  const balance = rewards.data?.balance ?? user!.points

  async function doRedeem(r: Reward) {
    try {
      const res = await redeem.mutateAsync({ rewardId: r.id, userId: user!.id })
      setConfirm(null)
      setCode(res)
      // Refresh the user: points changed, and a skill upgrade can change the level
      signIn(await api.login(user!.id))
    } catch {
      // error shown from redeem.error
    }
  }

  return (
    <section className="screen">
      <div className="hero">
        <p className="hello">Your points</p>
        <h1 className="who">
          <span className="num">{balance}</span> pts
        </h1>
        <p className="lede">Earn 10 for a best answer, 5 for finishing a ride, 20 for an assigned pack done on time.</p>
      </div>

      {rewards.isPending && <div className="skel tall" />}
      {rewards.isError && (
        <p className="alert bad" role="alert">
          {rewards.error.message}
        </p>
      )}

      {GROUPS.map(({ kind, title }) => {
        const list = rewards.data?.rewards.filter((r) => r.kind === kind) ?? []
        if (!list.length) return null
        return (
          <div key={kind} className="reward-group">
            <h2 className="panel-title">{title}</h2>
            {list.map((r) => {
              const short = Math.max(0, r.cost_points - balance)
              const out = r.stock <= 0
              return (
                <div key={r.id} className="rcard">
                  <div className="rcard-top">
                    <b className="grow">{r.title}</b>
                    <span className="cost num">{r.cost_points}</span>
                  </div>
                  {r.sponsor_name && <span className="chip warn">{r.sponsor_name}</span>}
                  <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={r.cost_points} aria-valuenow={Math.min(balance, r.cost_points)} aria-label={`Progress toward ${r.title}`}>
                    <i style={{ width: `${Math.min(100, (balance / r.cost_points) * 100)}%` }} />
                  </div>
                  <button className="go small" type="button" disabled={out || short > 0} onClick={() => setConfirm(r)}>
                    {out ? 'Out of stock' : short > 0 ? `${short} more points` : 'Redeem'}
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}

      <AnimatePresence>
        {(confirm || code) && (
          <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}>
              {code ? (
                <>
                  <h2 id="modal-title">{code.reward.title}</h2>
                  <p className="muted">Show this one-time code to redeem. It’s also saved to your history.</p>
                  <div className="code" aria-label={`Code ${code.code.split('').join(' ')}`}>
                    {code.code}
                  </div>
                  <p className="hint">{code.balance} points left</p>
                  <button className="go" type="button" autoFocus onClick={() => setCode(null)}>
                    Done
                  </button>
                </>
              ) : (
                confirm && (
                  <>
                    <h2 id="modal-title">Redeem {confirm.title}?</h2>
                    <p className="muted">
                      This uses <b>{confirm.cost_points}</b> of your {balance} points.
                    </p>
                    {redeem.isError && (
                      <p className="alert bad" role="alert">
                        {redeem.error.message}
                      </p>
                    )}
                    <button className="go" type="button" autoFocus disabled={redeem.isPending} onClick={() => doRedeem(confirm)}>
                      {redeem.isPending ? <span className="spin" aria-hidden="true" /> : null}
                      {redeem.isPending ? 'Redeeming…' : 'Redeem'}
                    </button>
                    <button
                      className="link"
                      type="button"
                      onClick={() => {
                        redeem.reset()
                        setConfirm(null)
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
