import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlayCircle, 
  MessageSquare, 
  ArrowUp, 
  Settings, 
  User, 
  Bell, 
  CheckCircle, 
  Brain, 
  TrendingUp, 
  Zap, 
  Globe, 
  Shield, 
  Store
} from 'lucide-react';
import './SwarmSimulation.css';

// --- Components ---

const LandingPage = ({ onStart, value, onChange }) => {
  const isActive = value.trim().length > 0;

  return (
    <div className="landing-page">
      {/* Aesthetic Ambient Lighting Effects */}
      <div className="ambient-light light-1"></div>
      <div className="ambient-light light-2"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="landing-content"
      >
        <div className="landing-header">
          <span className="badge-v2">
            Simulation Hub V2
          </span>
          <h1 className="landing-title">
            Simulate the Future <br/>
            <span className="text-blue">of Your SME.</span>
          </h1>
          <p className="landing-description">
            Harness the power of high-fidelity AI simulations to forecast growth, optimize operations, and mitigate risks in real-time.
          </p>
        </div>

        <div className="landing-actions">
          <motion.button 
            whileHover={isActive ? { scale: 1.02 } : {}}
            whileTap={isActive ? { scale: 0.95 } : {}}
            onClick={isActive ? onStart : undefined}
            disabled={!isActive}
            className={`btn-start ${isActive ? 'active' : 'disabled'}`}
          >
            <span>Start Simulation</span>
            <PlayCircle size={32} fill="currentColor" />
          </motion.button>

          {/* Integrated Chat Bar */}
          <div className="chat-bar-container">
            <div className="chat-bar">
              <div className="chat-icon">
                <MessageSquare size={20} />
              </div>
              <input 
                autoFocus
                className="chat-input"
                placeholder="Describe a business scenario..." 
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
              />
              <motion.button 
                whileHover={isActive ? { opacity: 0.9 } : {}}
                whileTap={isActive ? { scale: 0.9 } : {}}
                disabled={!isActive}
                className={`btn-arrow ${isActive ? 'active' : 'disabled'}`}
              >
                <ArrowUp size={20} />
              </motion.button>
            </div>
            <div className="tags">
                {[
                  'Launch Buy-1-Free-1 promo during Friday lunch rush', 
                  'Increase signature coffee price by RM2.00', 
                  'Competitor next door slashes prices by 50%'
                ].map((tag) => (
                  <button 
                    key={tag}
                    onClick={() => onChange(tag)}
                    className="tag-btn"
                  >
                    {tag}
                  </button>
                ))}
              </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const SimulationPage = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isDecisionGreen, setIsDecisionGreen] = useState(null);
  const [showShopPulse, setShowShopPulse] = useState(false);
  const [animationStep, setAnimationStep] = useState(0); // 0: enter, 1: decide, 2: exit

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 1000);
          return 100;
        }
        return p + 0.5;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [onComplete]);

  // Handle sequence
  useEffect(() => {
    let isCancelled = false;
    const runSequence = async () => {
      if (isCancelled) return;
      // Step 0: Human enters
      setAnimationStep(0);
      setIsDecisionGreen(null);
      await new Promise(r => setTimeout(r, 2000));

      if (isCancelled) return;
      // Step 1: Decision
      setAnimationStep(1);
      const isGreen = Math.random() > 0.5;
      setIsDecisionGreen(isGreen);
      await new Promise(r => setTimeout(r, 1000));

      if (isCancelled) return;
      // Step 2: Exit
      setAnimationStep(2);
      if (isGreen) {
        setShowShopPulse(true);
        setTimeout(() => setShowShopPulse(false), 800);
      }
      await new Promise(r => setTimeout(r, 1500));
      
      if (!isCancelled) {
        runSequence();
      }
    };

    runSequence();
    return () => { isCancelled = true; };
  }, []);

  return (
    <div className="simulation-page">
      <header className="sim-header">
        <div className="sim-logo">Atelier Sim</div>
        <div className="sim-nav-icons">
          <Settings className="nav-icon" size={24} />
          <User className="nav-icon" size={24} />
        </div>
      </header>

      <main className="sim-main">
        <div className="sim-status">
          <h1 className="status-title">INITIALIZING SIMULATION</h1>
          <p className="status-subtitle">Analyzing queue dynamics... Please wait.</p>
        </div>

        <div className="sim-canvas">
          <div className="grid-overlay"></div>

          <div className="stage">
            
            {/* The Queue (Left) */}
            <div className="queue-line">
              <div className="queue-item"><User size={20} /></div>
              <div className="queue-item"><User size={20} /></div>
              <div className="queue-item"><User size={20} /></div>
            </div>

            {/* Decision Circle (Center) */}
            <div className="decision-hub">
              <div className="rotating-border"></div>
              <div className={`central-node ${isDecisionGreen === true ? 'is-green' : isDecisionGreen === false ? 'is-red' : ''}`}>
                <Brain size={48} className={`node-icon ${isDecisionGreen === true ? 'text-green' : isDecisionGreen === false ? 'text-red' : 'text-blue'}`} />
              </div>

              {/* Status Indicators */}
              <div className={`indicator top ${isDecisionGreen === true ? 'active' : 'idle'}`}>
                <div className="bounce"><ArrowUp size={24} /></div>
                <span className="indicator-label">Accept</span>
              </div>
              <div className={`indicator bottom ${isDecisionGreen === false ? 'active' : 'idle'}`}>
                <span className="indicator-label">Reject</span>
                <div className="bounce rotate-180"><ArrowUp size={24} /></div>
              </div>
            </div>

            {/* The Shop (Right) */}
            <motion.div 
               animate={showShopPulse ? { scale: 1.05, boxShadow: '0 0 50px rgba(74, 222, 128, 0.3)' } : { scale: 1 }}
               className="shop-container"
            >
              <div className="shop-roof">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={`stripe ${i % 2 === 0 ? 'stripe-blue' : 'stripe-white'}`}></div>
                ))}
              </div>
              <div className="shop-body">
                <div className="shop-window">
                  <div className="window-inner">
                    <Store className="store-icon" size={24} />
                  </div>
                </div>
                <div className="shop-label">
                  <Zap size={12} fill="currentColor" />
                  <span>TAUKE PREMIUM SHOP</span>
                </div>
              </div>
            </motion.div>

            {/* The Human (Animated) */}
            <AnimatePresence mode="popLayout">
              {animationStep === 0 && (
                <motion.div
                  key="human-enter"
                  initial={{ x: -400, opacity: 0, scale: 0.5 }}
                  animate={{ x: -160, opacity: 1, scale: 1 }}
                  exit={{ opacity: 1 }}
                  className="human-actor"
                >
                  <div className="human-sprite">
                    <User size={40} className="sprite-icon" />
                  </div>
                </motion.div>
              )}

              {animationStep === 1 && (
                <motion.div
                  key="human-decide"
                  initial={{ x: -160, opacity: 1 }}
                  animate={{ x: 0, scale: 0.8, opacity: 0.5 }}
                  className="human-actor actor-priority"
                >
                  <div className="human-sprite">
                    <User size={40} className="sprite-icon" />
                  </div>
                </motion.div>
              )}

              {animationStep === 2 && (
                <motion.div
                  key="human-exit"
                  initial={{ x: 0, opacity: 0.5, scale: 0.8 }}
                  animate={isDecisionGreen 
                    ? { x: 320, opacity: 0, scale: 0.5 } // Enter Shop
                    : { y: 200, opacity: 0, scale: 1.2 }  // Fade Away / Fall
                  }
                  className="human-actor actor-priority"
                >
                  <div className="human-sprite">
                    <User size={40} className={`sprite-icon ${isDecisionGreen ? 'text-green' : 'text-red'}`} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Progress Bar (Bottom) */}
          <div className="progress-container">
            <div className="progress-track">
              <motion.div 
                className="progress-fill"
                animate={{ width: `${progress}%` }}
              ></motion.div>
            </div>
            <div className="progress-labels">
              <span className="label-left">{Math.floor(progress)}% SYNCHRONIZED</span>
              <span className="label-right">BOUTIQUE INSTANCE: #042</span>
            </div>
          </div>
        </div>

        <div className="sim-chips">
          {[
            { icon: <User size={16} />, text: "Active Agents: 1,240", color: "blue" },
            { icon: <Zap size={16} />, text: "Processing Latency: 14ms", color: "green" },
            { icon: <Brain size={16} />, text: "Logic: Atelier-v2", color: "blue" }
          ].map((chip, i) => (
            <div key={i} className="sim-chip">
              <div className={`chip-icon text-${chip.color}`}>{chip.icon}</div>
              <span className="chip-text">{chip.text}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

const ResultsPage = ({ scenario }) => {
  return (
    <div className="results-page">
      <main className="results-container">
        <div className="results-header">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="results-id">Simulation ID: TK-8829-V2</span>
            <h1 className="results-title">Simulation Results</h1>
            <p className="results-scenario">{scenario || "Market Expansion Strategy: Southeast Asia Phase 1 Focus"}</p>
          </motion.div>
          <div className="header-actions">
            <button className="btn-secondary">Export Report</button>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.01, translateY: -4 }}
          whileTap={{ scale: 0.99 }}
          className="verdict-card"
        >
          <div className="verdict-glow"></div>
          <div className="verdict-content">
            <div className="verdict-text-side">
              <div className="recommendation-badge">
                <CheckCircle size={16} />
                AI Recommendation
              </div>
              <h2 className="verdict-main-text">
                Verdict: <span className="text-green">Proceed</span>
              </h2>
              <p className="verdict-secondary-text">
                The simulation indicates an 89.4% probability of exceeding target ROI within the first 14 months of deployment.
              </p>
            </div>
            <div className="verdict-meter-side">
              <div className="confidence-meter">
                <svg className="meter-svg" viewBox="0 0 192 192">
                  <circle 
                    cx="96" cy="96" r="86" 
                    fill="transparent" 
                    stroke="var(--slate-100)" 
                    strokeWidth="10" 
                  />
                  <motion.circle 
                    initial={{ strokeDashoffset: 540 }}
                    animate={{ strokeDashoffset: 540 * (1 - 0.89) }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                    cx="96" cy="96" r="86" 
                    fill="transparent" 
                    stroke="var(--green-600)" 
                    strokeWidth="10" 
                    strokeDasharray="540" 
                    strokeLinecap="round" 
                  />
                </svg>
                <div className="meter-labels">
                  <motion.span 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1, duration: 0.5 }}
                    className="meter-percent"
                  >
                    89%
                  </motion.span>
                  <span className="meter-name">Confidence</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="results-grid">
          <div className="main-stats-column">
            <div className="strategic-reasoning-card">
              <div className="card-header">
                <div className="card-icon-container">
                  <Brain size={24} />
                </div>
                <h3 className="card-title">Strategic Reasoning</h3>
              </div>
              <div className="reasoning-items">
                {[
                  { num: "01", title: "High Market Velocity Resilience", desc: "The model anticipates a surge in competitor response by Q3. However, current supply chain agility metrics suggest a 'first-mover' lock-in." },
                  { num: "02", title: "Operational Impact Balancing", desc: "Unlike previous versions, V2 leverages a distributed logistics node architecture. This reduces single-point-of-failure exposure." },
                  { num: "03", title: "Consumer Sentiment Tailwinds", desc: "Sentiment analysis shows a strong affinity for sustainable packaging, allowing for a 12% premium pricing structure." }
                ].map((item, i) => (
                  <div key={i} className="reasoning-item">
                    <div className="item-num">{item.num}</div>
                    <div className="item-content">
                      <h4 className="item-title">{item.title}</h4>
                      <p className="item-desc">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="kpi-grid">
              {[
                { label: "Growth Projection", val: "+42.8%", sub: "Estimated YoY Growth", color: "green", p: "42%" },
                { label: "Risk Exposure", val: "Low", sub: "Volatility Index: 0.14", color: "blue", p: "14%" },
                { label: "Capital Efficiency", val: "1.8x", sub: "Return per Dollar Spent", color: "blue", p: "75%" }
              ].map((card, i) => (
                <div key={i} className="kpi-card">
                  <div className="kpi-label">{card.label}</div>
                  <div className={`kpi-value text-${card.color}`}>{card.val}</div>
                  <div className="kpi-sub">{card.sub}</div>
                  <div className="kpi-progress">
                    <div className={`kpi-fill bg-${card.color}`} style={{ width: card.p }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="actions-column">
            <h3 className="column-title">Recommended Actions</h3>
            <div className="actions-list">
              <motion.div 
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                className="action-card"
              >
                <div className="action-icon icon-green">
                  <TrendingUp size={24} />
                </div>
                <h4 className="action-label">Recommended Promotion</h4>
                <div className="action-value">+12% ROI</div>
                <p className="action-desc">Predicted lift from Q4 targeted loyalty initiative.</p>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                className="action-card"
              >
                <div className="action-icon icon-blue">
                  <Shield size={24} />
                </div>
                <h4 className="action-label">Risk Mitigation</h4>
                <div className="action-value">CAPEX</div>
                <p className="action-desc">Reallocate 15% of unused marketing budget to R&D.</p>
              </motion.div>

              <motion.div 
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                className="action-card"
              >
                <div className="action-icon icon-blue">
                  <Globe size={24} />
                </div>
                <h4 className="action-label">Audience Target</h4>
                <div className="action-value">Gen-Z (SEA)</div>
                <p className="action-desc">Heaviest alignment with sustainable packaging metrics.</p>
              </motion.div>
            </div>

            <div className="cta-card">
              <div className="cta-glow"></div>
              <h4 className="cta-title">Need a different scenario?</h4>
              <p className="cta-desc">Clone this simulation and modify variables to explore 'What-If' scenarios instantly.</p>
              <button className="btn-cta">
                Clone Simulation
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer-standard">
        <div className="footer-inner">
          <div className="footer-logo">Tauke.AI</div>
          <p className="footer-copy">© 2026 Tauke.AI. Crafted in the Digital Atelier.</p>
          <div className="footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function SwarmSimulation() {
  const [view, setView] = useState('LANDING');
  const [scenarioInput, setScenarioInput] = useState('');

  const startSimulation = () => {
    setView('SIMULATING');
  };

  const finishSimulation = () => {
    setView('RESULTS');
  };

  return (
    <div className="app-container">
      <AnimatePresence mode="wait">
        {view === 'LANDING' ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <LandingPage 
              onStart={startSimulation} 
              value={scenarioInput} 
              onChange={setScenarioInput} 
            />
          </motion.div>
        ) : view === 'SIMULATING' ? (
          <motion.div
            key="simulating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="full-width"
          >
            <SimulationPage onComplete={finishSimulation} />
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
          >
            <ResultsPage scenario={scenarioInput} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Bottom Footer (only on landing for now) */}
      {view === 'LANDING' && (
        <footer className="footer-landing">
          <div className="footer-inner-landing">
            <div className="footer-brand">
              <div className="footer-logo">Tauke.AI</div>
              <div className="footer-copy-landing">© 2026 Tauke.AI. The Digital Atelier for SME Intelligence.</div>
            </div>
            <div className="footer-links-landing">
              {['Privacy Policy', 'Terms of Service', 'Contact Support', 'API Docs'].map(link => (
                <a key={link} href="#">{link}</a>
              ))}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
