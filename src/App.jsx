/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PlayCircle, 
  MessageSquare, 
  ArrowUp, 
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isEnabled = prompt.trim().length > 0;

  const handleStartSimulation = () => {
    if (isEnabled) {
      console.log('Starting simulation with prompt:', prompt);
    }
  };

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <header className="header">
        <nav className="nav max-width-wrapper">
          <div className="logo" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            Tauke.AI
          </div>
          
          <div className="nav-links">
            <a href="#" className="nav-link">Platform</a>
            <a href="#" className="nav-link">Intelligence</a>
            <a href="#" className="nav-link active">Simulations</a>
            <a href="#" className="nav-link">Pricing</a>
          </div>

          <div className="nav-actions">
            <button className="btn btn-login">
              Login
            </button>
            <button className="btn btn-primary">
              Start Simulation
            </button>
            <button 
              className="mobile-nav-toggle"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mobile-menu"
            >
              <a href="#">Platform</a>
              <a href="#">Intelligence</a>
              <a href="#" style={{color: 'var(--primary)'}}>Simulations</a>
              <a href="#">Pricing</a>
              <div style={{marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                <button className="btn" style={{justifyContent: 'flex-start'}}>Login</button>
                <button className="btn btn-primary" style={{justifyContent: 'center', padding: '1rem'}}>Start Simulation</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="hero">
        <div className="ambient-light-1"></div>
        <div className="ambient-light-2"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-width-wrapper"
        >
          <div className="badge-wrapper">
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="badge"
            >
              Simulation Hub V2
            </motion.span>
          </div>
          
          <h1 className="title">
            Simulate the Future <br />
            <span className="text-gradient">of Your SME.</span>
          </h1>
          
          <p className="description">
            Harness the power of high-fidelity AI simulations to forecast growth, optimize operations, and mitigate risks in real-time.
          </p>

          <div className="interactive-section">
            {/* Big Start Simulation Button */}
            <motion.button
              onClick={handleStartSimulation}
              disabled={!isEnabled}
              animate={{
                scale: isEnabled ? [1, 1.02, 1] : 1,
              }}
              transition={{
                duration: 2,
                repeat: isEnabled ? Infinity : 0,
                ease: "easeInOut"
              }}
              className="btn btn-primary btn-simulation-big"
            >
              <span>Start Simulation</span>
              <PlayCircle 
                size={34} 
                fill={isEnabled ? "white" : "currentColor"} 
              />
            </motion.button>

            {/* Integrated Chat Bar */}
            <div className="chat-container">
              <div className="chat-bar">
                <div className="chat-icon">
                  <MessageSquare size={20} />
                </div>
                
                <input 
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe a business scenario..."
                  className="chat-input"
                />
                
                <button 
                  disabled={!isEnabled}
                  onClick={handleStartSimulation}
                  className="chat-send-btn"
                >
                  <ArrowUp size={20} strokeWidth={3} />
                </button>
              </div>
              
              <div className="tags">
                {['Pricing Strategy', 'Supply Chain Shock', 'New Market Entry'].map((tag) => (
                  <button 
                    key={tag}
                    onClick={() => setPrompt(tag)}
                    className="tag-btn"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content max-width-wrapper">
          <div className="footer-info">
            <div className="footer-logo">Tauke.AI</div>
            <div className="footer-copy">
              © 2024 Tauke.AI. The Digital Atelier for SME Intelligence.
            </div>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Contact Support</a>
            <a href="#" className="footer-link">API Docs</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

