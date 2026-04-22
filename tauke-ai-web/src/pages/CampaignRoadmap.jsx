import { NavLink } from "react-router-dom";
import "./CampaignRoadmap.css";

const navItems = [
  { label: "Intelligence", icon: "insights", to: "/intelligence" },
  { label: "Strategy", icon: "task_alt", to: "/strategy", active: true },
  { label: "Financials", icon: "account_balance_wallet", to: "/financials" },
  { label: "Operations", icon: "storefront", to: "/operations" },
  { label: "Settings", icon: "settings", to: "/settings" }
];

const roadmapPhases = [
  {
    phase: "PHASE 01",
    title: "Digital Audit & Forensic Scan",
    description: "A deep-dive into existing assets, conversion bottlenecks, and sentiment mapping across all boutique touchpoints. We leave no pixel unturned.",
    tags: ["SEO HEALTH", "SENTIMENT AI"],
    date: "Sept 14, 2024",
    statusText: "On Track",
    statusIcon: "check_circle",
    statusClass: "success",
    timelineIcon: "search",
    align: "left", // Content left, Date right
    state: "completed"
  },
  {
    phase: "PHASE 02",
    title: "Pilot Deployment & Beta",
    description: "Testing the AI engine on a small, curated segment of high-value prospects. Rapid feedback loops and creative pivoting in real-time.",
    tags: ["A/B TESTING", "USER FEEDBACK"],
    date: "Oct 05, 2024",
    statusText: "Next Phase",
    statusIcon: "arrow_forward",
    statusClass: "active",
    timelineIcon: "rocket_launch",
    align: "right", // Date left, Content right
    state: "active"
  },
  {
    phase: "PHASE 03",
    title: "Ecosystem Scaling",
    description: "Full-throttle activation across all channels. Integration of the V2 Boutique Engine into the core brand ecosystem for global reach.",
    tags: ["GLOBAL ROLLOUT", "FULL AUTOMATION"],
    date: "Nov 22, 2024",
    statusText: "Pending P1/P2",
    statusIcon: "",
    statusClass: "pending",
    timelineIcon: "trending_up",
    align: "left", // Content left, Date right
    state: "pending"
  }
];

// Helper components to keep the main render clean
const MainBlock = ({ phase }) => (
  <div className="main-block">
    <p className="phase-label">{phase.phase}</p>
    <h4>{phase.title}</h4>
    <p>{phase.description}</p>
    <div className="tags">
      {phase.tags.map(tag => (
        <span key={tag} className="tag">{tag}</span>
      ))}
    </div>
  </div>
);

const DateBlock = ({ phase }) => (
  <div className="date-block">
    <span className="date-label">PROJECTED COMPLETION</span>
    <div className="date-row">
      <span className="date-value">{phase.date}</span>
      <span className={`status-badge ${phase.statusClass}`}>
        {phase.statusIcon && <span className="material-symbols-outlined">{phase.statusIcon}</span>}
        {phase.statusText}
      </span>
    </div>
  </div>
);

export default function CampaignRoadmap() {
  return (
    <div className="roadmap-page">
      {/* Sidebar Area */}
      <aside className="roadmap-sidebar" aria-label="Sidebar">
        <div className="roadmap-brand-block">
          <h1 className="roadmap-brand-title">Tauke.AI</h1>
          <p className="roadmap-brand-subtitle">V2 BOUTIQUE EDITION</p>
        </div>

        <nav className="roadmap-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) => `roadmap-nav-item${isActive || item.active ? " is-active" : ""}`}
            >
              <span className="material-symbols-outlined roadmap-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="roadmap-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="btn-generate">Generate Report</button>
          <div className="bottom-links">
            <a href="#help" className="bottom-link">
              <span className="material-symbols-outlined">help</span> Help Center
            </a>
            <a href="#logout" className="bottom-link">
              <span className="material-symbols-outlined">logout</span> Sign Out
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="roadmap-main">
        {/* Top Navigation */}
        <header className="top-nav">
          <div className="search-bar">
            <span className="material-symbols-outlined">search</span>
            <input type="text" placeholder="Search roadmap..." />
          </div>

          <div className="top-tabs">
            <a href="#dashboard" className="top-tab">Dashboard</a>
            <a href="#advisory" className="top-tab">Advisory</a>
            <a href="#insights" className="top-tab active">Insights</a>
          </div>

          <div className="top-profile">
            <span className="material-symbols-outlined bell-icon">notifications</span>
            <div className="avatar">A</div>
          </div>
        </header>

        {/* Scrolling Content */}
        <div className="roadmap-content">
          <header className="page-header">
            <p className="kicker">STRATEGIC BLUEPRINT</p>
            <h2 className="page-title">Campaign Roadmap</h2>
            <p className="page-subtitle">
              A structured visual execution path for the Boutique Edition rollout. Driven by AI-optimization and artisanal brand positioning.
            </p>
          </header>

          {/* Execution Summary */}
          <section className="execution-summary-section">
            <div className="summary-card">
              <h3>Execution Summary</h3>
              <div className="summary-stats">
                <div className="stat-item">
                  <p className="label">DURATION</p>
                  <p className="value">12 Weeks</p>
                </div>
                <div className="stat-item">
                  <p className="label">INTENSITY</p>
                  <p className="value"><span className="intensity">●●●</span> High</p>
                </div>
                <div className="stat-item">
                  <p className="label">TARGET ROI</p>
                  <p className="value green">3.4x</p>
                </div>
              </div>
              <div className="summary-footer">
                <div className="team-avatars">
                  {/* Replace with actual image src if available, using placeholders */}
                  <img src="https://i.pravatar.cc/100?img=1" alt="Team 1" />
                  <img src="https://i.pravatar.cc/100?img=2" alt="Team 2" />
                  <div className="team-more">+</div>
                </div>
                <a href="#capacity" className="view-capacity">View Team Capacity &gt;</a>
              </div>
            </div>

            <div className="ai-confidence-card">
              <span className="material-symbols-outlined stars-icon">auto_awesome</span>
              <h2>92%</h2>
              <p>AI Confidence Rating for Q3 completion targets, based on current momentum.</p>
            </div>
          </section>

          {/* Central Alternating Timeline */}
          <section className="central-timeline">
            {roadmapPhases.map((phase, index) => (
              <div className={`timeline-row ${phase.state}`} key={index}>
                <div className="timeline-col-left">
                  {phase.align === "left" ? <MainBlock phase={phase} /> : <DateBlock phase={phase} />}
                </div>

                <div className="timeline-center-icon">
                  <span className="material-symbols-outlined">{phase.timelineIcon}</span>
                </div>

                <div className="timeline-col-right">
                  {phase.align === "left" ? <DateBlock phase={phase} /> : <MainBlock phase={phase} />}
                </div>
              </div>
            ))}
          </section>

          {/* Bottom CTA */}
          <section className="cta-section">
            <div className="cta-content">
              <h3>Ready to accelerate the timeline?</h3>
              <p>Our advisory team can provision additional computational resources to compress Phase 2 by up to 14 days.</p>
            </div>
            <div className="cta-actions">
              <button className="btn-secondary">Schedule Advisory</button>
              <button className="btn-primary">Enable Turbo Mode</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}