import { NavLink, useNavigate } from "react-router-dom";
import "./FinalSynthesis.css";

const navItems = [
  { label: "Store Setup", icon: "storefront", to: "/store-configuration" },
  { label: "Data Sync", icon: "sync", to: "/data-sync" },
  { label: "Analysis", icon: "insights", to: "/detective-analysis" },
  { label: "Clarification", icon: "forum", to: "/supervisor-clarification" },
  { label: "War Room", icon: "groups", to: "/ai-debate" },
  { label: "Strategy Synthesis", icon: "hub", to: "/final-synthesis", active: true }
];

const supportingCards = [
  {
    title: "WHY NOT PRICE MATCH",
    copy: "Direct matching drives fast volume but compresses gross margin beyond the threshold needed for stable weekly cashflow.",
    badge: "MARGIN SAFETY"
  },
  {
    title: "EXPECTED IMPACT",
    copy: "Projected +9% order recovery in 4 to 6 weeks with healthier contribution margin than broad discount-led alternatives.",
    badge: "BALANCED GROWTH"
  },
  {
    title: "OPERATIONAL FIT",
    copy: "The rollout can be executed with current staffing and supplier cadence, reducing implementation risk during peak periods.",
    badge: "EXECUTION READY"
  }
];

const recommendationDetails = [
  {
    title: "A. Why this is recommended",
    copy:
      "It captures demand sensitivity without triggering broad discount dependency. The model favors this route because it balances conversion lift with controlled downside risk across cashflow, operational load, and margin stability."
  },
  {
    title: "B. Business fit / expected impact",
    copy:
      "Expected to improve weekly transaction momentum while maintaining margin discipline. Forecast indicates healthier recovery velocity versus full price-match tactics, with better sustainability over the next quarter."
  }
];

export default function FinalSynthesis() {
  const navigate = useNavigate();

  return (
    <div className="synthesis-page">
      <aside className="synthesis-sidebar" aria-label="Sidebar">
        <div className="sidebar-brand-block">
          <h1 className="sidebar-brand-title">Tauke.AI</h1>
          <p className="sidebar-brand-subtitle">SME Intelligence</p>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) => `sidebar-nav-item${isActive || item.active ? " is-active" : ""}`}
            >
              <span className="material-symbols-outlined sidebar-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="sidebar-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user-block">
          <div className="sidebar-avatar" aria-hidden="true">A</div>
          <div>
            <p className="sidebar-user-name">Admin User</p>
            <p className="sidebar-user-meta">Manage Account</p>
          </div>
        </div>
      </aside>

      <main className="synthesis-main">
        <div className="synthesis-shell">
          <header className="synthesis-header">
            <h2 className="synthesis-title">Final Synthesis</h2>
            <p className="synthesis-subtitle">
              The system is now presenting the safest and most suitable final recommendation based on
              cross-agent consensus, business constraints, and expected outcome quality.
            </p>
          </header>

          <section className="consensus-card" aria-label="Final recommendation">
            <div className="consensus-head">
              <p className="consensus-kicker">CONSENSUS RECOMMENDATION</p>
              <span className="consensus-pill">HIGHEST CONFIDENCE PATH</span>
            </div>

            <h3 className="consensus-title">Targeted Value Bundle With Guardrailed Promotions</h3>
            <p className="consensus-summary">
              Prioritize a value-bundle strategy focused on high-volume windows, while keeping selective
              promotional caps by category to protect contribution margin and avoid reactive price wars.
            </p>

            <div className="consensus-grid">
              {recommendationDetails.map((item) => (
                <article key={item.title} className="consensus-block">
                  <h4>{item.title}</h4>
                  <p>{item.copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="support-grid" aria-label="Supporting rationale cards">
            {supportingCards.map((card) => (
              <article key={card.title} className="support-card">
                <span className="support-badge">{card.badge}</span>
                <h4>{card.title}</h4>
                <p>{card.copy}</p>
              </article>
            ))}
          </section>

          <div className="synthesis-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => navigate("/ai-debate")}
            >
              Back to War Room
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => navigate("/campaign-roadmap")}
            >
              Continue to Roadmap <span aria-hidden="true">{"\u2192"}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
