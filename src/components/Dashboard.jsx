import { motion } from 'motion/react';
import { Settings, User, BarChart3, Users, Bolt, Activity, Home, Briefcase, ShoppingBag, ArrowUpRight, TrendingUp, Clock, ShieldCheck } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="dashboard-container">
      {/* Background Decor */}
      <div className="bg-decor-top" />
      <div className="bg-decor-bottom" />

      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div className="logo-icon">
            <Activity size={20} />
          </div>
          Atelier Sim
        </div>
        <div className="header-actions">
          <Settings className="icon-button" size={24} />
          <User className="icon-button" size={24} />
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', paddingTop: '8rem', paddingBottom: '8rem', flexGrow: 1, overflowY: 'auto' }}>
        <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 className="label-caps">MANAGEMENT DASHBOARD</h1>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.025em', color: '#1a1c1d' }}>Simulation Analysis Report</h2>
          </div>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn-primary"
          >
            Restart Simulation <ArrowUpRight size={16} />
          </motion.button>
        </header>

        {/* Stats Grid */}
        <div className="stats-grid">
          {[
            { label: 'Total Synchronized', value: '2,840', unit: 'Agents', icon: Users, color: '#0058bc' },
            { label: 'Average Throughput', value: '92.4', unit: '%', icon: TrendingUp, color: '#006e28' },
            { label: 'Uptime Reliability', value: '99.9', unit: '%', icon: ShieldCheck, color: '#0058bc' },
            { label: 'Session Duration', value: '42:15', unit: 'Minutes', icon: Clock, color: '#717786' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="stat-card"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div style={{ width: '3rem', height: '3rem', backgroundColor: '#eeeef0', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <stat.icon style={{ color: stat.color }} size={24} />
                </div>
              </div>
              <h3 className="label-caps" style={{ color: '#717786', marginBottom: '0.25rem' }}>{stat.label}</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.025em', color: '#1a1c1d' }}>{stat.value}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#717786' }}>{stat.unit}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Dynamic Analysis Card */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, minmax(0, 1fr))', gap: '1.5rem' }}>
          <div style={{ gridColumn: 'span 1' }}>
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="chart-card"
              style={{ height: '100%' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em' }}>Queue Efficiency Over Time</h3>
                <select style={{ backgroundColor: '#f3f3f5', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0.5rem 1rem', borderRadius: '0.5rem', outline: 'none', border: 'none' }}>
                  <option>Last 24 Hours</option>
                  <option>Last 7 Days</option>
                </select>
              </div>
              
              <div style={{ height: '16rem', display: 'flex', alignItems: 'flex-end', gap: '0.75rem', padding: '0 1rem' }}>
                {[60, 45, 75, 40, 85, 95, 65, 55, 80, 70, 90, 85].map((h, i) => (
                  <motion.div 
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: i * 0.05, duration: 1, ease: 'easeOut' }}
                    style={{ 
                      flex: 1, 
                      backgroundColor: '#0058bc', 
                      backgroundImage: 'linear-gradient(to top, rgba(0, 88, 188, 0.1), rgba(0, 88, 188, 1))',
                      borderTopLeftRadius: '0.375rem',
                      borderTopRightRadius: '0.375rem',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', padding: '0 0.5rem' }}>
                {['00h', '04h', '08h', '12h', '16h', '20h'].map(t => (
                  <span key={t} className="label-caps" style={{ color: '#717786', marginBottom: 0 }}>{t}</span>
                ))}
              </div>
            </motion.div>
          </div>

          <div style={{ gridColumn: 'span 1' }}>
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="chart-card"
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '2.5rem' }}>Simulation Insights</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {[
                  { title: 'Wait Logic Shifted', desc: 'Algorithm updated to v4.2 naturally.', time: '2m ago' },
                  { title: 'Peak Observed', desc: '142 agents synchronized at 09:12 AM.', time: '1h ago' },
                  { title: 'Data Pipeline Secure', desc: 'Encryption protocols verified.', time: '4h ago' },
                ].map((insight, i) => (
                  <div key={i} style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ width: '0.375rem', height: '2.5rem', backgroundColor: '#0058bc', borderRadius: '9999px', flexShrink: 0, marginTop: '0.25rem' }} />
                    <div>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, letterSpacing: '-0.025em', color: '#1a1c1d' }}>{insight.title}</h4>
                      <p style={{ fontSize: '0.75rem', color: '#717786', fontWeight: 500 }}>{insight.desc}</p>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(0, 88, 188, 0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{insight.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Navigation */}
      <nav className="nav-bar">
        <button className="nav-item">
          <Users size={24} style={{ marginBottom: '0.25rem' }} />
          <span className="nav-label">Queue</span>
        </button>
        <button className="nav-item active">
          <Briefcase size={24} style={{ marginBottom: '0.25rem' }} />
          <span className="nav-label">Vault</span>
        </button>
        <button className="nav-item">
          <ShoppingBag size={24} style={{ marginBottom: '0.25rem' }} />
          <span className="nav-label">Store</span>
        </button>
      </nav>
    </div>
  );
}
