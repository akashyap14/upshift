interface Props<T extends string | number> {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange(value: T): void
}

export function Pills<T extends string | number>({ label, options, value, onChange }: Props<T>) {
  return (
    <div>
      <div className="lab">{label}</div>
      <div className="pills" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
