import { DemoLogin } from '../components/DemoLogin'

export function Login() {
  return (
    <section className="screen">
      <div className="hero">
        <p className="hello">Your commute, turned into skill time</p>
        <h1 className="who">Your commute, your upgrade.</h1>
        <p className="lede">Two-minute rounds from your company’s material and this week’s news. Earn points, redeem rewards.</p>
      </div>
      <div className="panel">
        <h2 className="panel-title">Who’s riding?</h2>
        <DemoLogin roles={['employee', 'manager', 'leader']} />
      </div>
    </section>
  )
}
