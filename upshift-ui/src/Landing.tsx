import { Link } from 'react-router'
import { Brand } from './components/Logo'

export function Landing() {
  return (
    <main className="landing">
      <Brand size={44} />
      <p className="muted">Turn Bengaluru traffic time into skill time.</p>
      <div className="landing-cards">
        <Link className="landing-card" to="/app">
          <h2>Mobile app</h2>
          <p className="muted">For employees. Play two-minute rounds on the commute, by voice or tap. Earn points and redeem rewards.</p>
          <span className="cta">Open the app →</span>
        </Link>
        <Link className="landing-card" to="/admin">
          <h2>Company web app</h2>
          <p className="muted">For managers and leaders. Upload documents, approve AI-written question packs, assign them to teams and watch the dashboard.</p>
          <span className="cta">Open for companies →</span>
        </Link>
      </div>
    </main>
  )
}
