import type { Source } from '../lib/api'

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Web pages the questions drew on. Shown whenever web search was used (citations are required).
export function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null
  return (
    <details className="sources">
      <summary>
        Based on {sources.length} web {sources.length === 1 ? 'source' : 'sources'}
      </summary>
      <ul>
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title}
            </a>
            <small>{host(s.url)}</small>
          </li>
        ))}
      </ul>
    </details>
  )
}
