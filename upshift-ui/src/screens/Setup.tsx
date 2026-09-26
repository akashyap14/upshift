import { Motif } from '../components/Motif'
import { Pills } from '../components/Pills'
import { ProfessionPicker } from '../components/ProfessionPicker'
import { roundsForEta, type Level, type Profession, type Track } from '../lib/professions'

export interface SetupValues {
  profId: string
  level: Level
  track: Track
  eta: number
  passenger: boolean
}

interface Props {
  values: SetupValues
  shown: Profession
  onChange(patch: Partial<SetupValues>): void
  onPreview(id: string | null): void
  onStart(): void
}

export function Setup({ values, shown, onChange, onPreview, onStart }: Props) {
  const rounds = roundsForEta(values.eta)
  return (
    <section className="screen">
      <div className="hero">
        <p className="hello">Your commute, turned into skill time</p>
        <h1 className="who swap" key={shown.id}>
          {shown.name}
        </h1>
        <Motif motif={shown.motif} />
      </div>
      <div className="panel">
        <ProfessionPicker
          label="Choose profession"
          value={values.profId}
          onChange={(profId) => onChange({ profId })}
          onPreview={onPreview}
        />
        <Pills
          label="Level"
          value={values.level}
          onChange={(level) => onChange({ level })}
          options={[
            { value: 1, label: 'Junior' },
            { value: 2, label: 'Mid' },
            { value: 3, label: 'Leader' },
          ]}
        />
        <Pills
          label="Rounds"
          value={values.track}
          onChange={(track) => onChange({ track })}
          options={[
            { value: 'mixed', label: 'Mixed' },
            { value: 'skill', label: 'Skill' },
            { value: 'ai', label: 'AI' },
          ]}
        />
        <div>
          <label className="lab" htmlFor="eta">
            Ride time
          </label>
          <div className="eta">
            <b>{values.eta} min</b>
            <span>
              {rounds} {rounds === 1 ? 'round' : 'rounds'}
            </span>
          </div>
          <input
            type="range"
            id="eta"
            min={5}
            max={60}
            step={1}
            value={values.eta}
            onChange={(e) => onChange({ eta: +e.target.value })}
          />
        </div>
        <label className="check">
          <input type="checkbox" checked={values.passenger} onChange={(e) => onChange({ passenger: e.target.checked })} />
          I’m a passenger, not driving
        </label>
        <button className="go" type="button" disabled={!values.passenger} onClick={onStart}>
          Start ride
        </button>
      </div>
    </section>
  )
}
