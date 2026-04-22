import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, User, BarChart3, Store, ArrowUp, ArrowDown, Users, Bolt, Activity, Home, Briefcase, ShoppingBag } from 'lucide-react';

export default function LoadingScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [queue, setQueue] = useState(Array.from({ length: 5 }, (_, i) => ({ id: `p-${i}`, status: 'queued' })));
  const [nextId, setNextId] = useState(5);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [showShopPulse, setShowShopPulse] = useState(false);
  const totalSlots = 20;

  const processQueue = useCallback(() => {
    if (progress >= 100) {
      onComplete();
      return;
    }

    setQueue(prev => {
      const newQueue = [...prev];
      if (newQueue.length === 0) return newQueue;

      const person = { ...newQueue[0] };
      
      // Phase 1: Move to decision point
      person.status = 'moving';
      newQueue[0] = person;

      // Phase 2: At decision point, decide
      setTimeout(() => {
        setQueue(q => {
          const updated = [...q];
          if (!updated[0]) return updated;
          const p = { ...updated[0], status: 'deciding' };
          updated[0] = p;
          return updated;
        });

        // Small delay for "scanning" feel
        setTimeout(() => {
          const isAccepted = Math.random() > 0.4;
          
          setQueue(q => {
            const updated = [...q];
            if (!updated[0]) return updated;
            const status = isAccepted ? 'accepted' : 'rejected';
            const p = { ...updated[0], status };
            updated[0] = p;
            return updated;
          });

          if (isAccepted) {
            setAcceptedCount(c => {
              const newCount = c + 1;
              const newProgress = Math.min((newCount / totalSlots) * 100, 100);
              setProgress(newProgress);
              return newCount;
            });
            // Trigger shop effect
            setTimeout(() => setShowShopPulse(true), 500);
            setTimeout(() => setShowShopPulse(false), 1200);
          }

          // Phase 3: Complete transition/Fade 
          setTimeout(() => {
            setQueue(q => {
              const filtered = q.filter((_, i) => i !== 0);
              return [...filtered, { id: `p-${nextId + Math.random()}`, status: 'queued' }];
            });
            setNextId(n => n + 1);
          }, 1000);

        }, 800);
      }, 800);

      return newQueue;
    });
  }, [progress, nextId, onComplete]);

  useEffect(() => {
    const interval = setInterval(processQueue, 3500);
    return () => clearInterval(interval);
  }, [processQueue]);

  return (
    <div className="app-container">
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

      <main style={{ width: '100%', maxWidth: '1024px', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '6rem', paddingBottom: '8rem' }}>
        <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <h1 className="label-caps">INITIALIZING SIMULATION</h1>
          <p className="subtext">Analyzing queue dynamics... Please wait.</p>
        </div>

        {/* Global Glass Card */}
        <div className="glass-card">
          {/* Grid Pattern */}
          <div className="grid-pattern" />

          {/* Queue Visualization */}
          <div style={{ display: 'flex', alignItems: 'center', zIndex: 10, width: '100%', position: 'relative', height: '100%' }}>
            {/* The Queue (Left) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative', width: '40%' }}>
              <AnimatePresence mode="popLayout">
                {queue.map((person, index) => (
                  <motion.div
                    key={person.id}
                    layout
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ 
                      opacity: 1, 
                      x: person.status === 'moving' || person.status === 'deciding' || person.status === 'accepted' || person.status === 'rejected' ? 250 : 0,
                      scale: person.status === 'moving' || person.status === 'deciding' ? 1.3 : (index === 0 ? 1.1 : 1),
                      zIndex: index === 0 ? 50 : 10,
                      backgroundColor: person.status === 'accepted' ? '#72fe88' : person.status === 'rejected' ? '#ffdad6' : '#ffffff',
                      borderColor: person.status === 'accepted' ? '#006e28' : person.status === 'rejected' ? '#ba1a1a' : (index === 0 ? '#0058bc' : 'transparent'),
                    }}
                    exit={{ 
                      opacity: 0, 
                      x: person.status === 'accepted' ? 600 : (person.status === 'rejected' ? 250 : 0),
                      y: person.status === 'rejected' ? 100 : 0,
                      scale: 0.5,
                      filter: 'blur(8px)'
                    }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 260, 
                      damping: 30,
                      backgroundColor: { duration: 0.4 },
                      borderColor: { duration: 0.4 }
                    }}
                    className={`person-icon ${index === 0 ? 'active' : ''}`}
                    style={{ position: 'relative' }}
                  >
                    <User 
                      size={32}
                      className={`
                        ${person.status === 'accepted' ? 'text-secondary' : ''} 
                        ${person.status === 'rejected' ? 'text-error' : ''} 
                        ${person.status === 'moving' || person.status === 'deciding' ? 'text-primary' : ''}`}
                      style={{ 
                        color: person.status === 'accepted' ? '#006e28' : person.status === 'rejected' ? '#ba1a1a' : (person.status === 'moving' || person.status === 'deciding' || index === 0 ? '#0058bc' : '#717786')
                      }}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Decision Logic (Center) */}
            <div style={{ position: 'absolute', left: '45%', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', zIndex: 20 }}>
              <div style={{ position: 'relative', width: '7rem', height: '7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div 
                  style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    borderRadius: '9999px', 
                    border: '2px dashed rgba(0, 88, 188, 0.3)',
                    animation: 'spin 20s linear infinite'
                  }} 
                />
                <div style={{ width: '4rem', height: '4rem', borderRadius: '9999px', backgroundColor: 'white', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', margin: 'auto' }}>
                  <BarChart3 style={{ color: '#0058bc' }} size={32} />
                  <AnimatePresence>
                    {queue[0]?.status === 'deciding' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1.2 }}
                        exit={{ opacity: 0 }}
                        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 88, 188, 0.1)', borderRadius: '9999px' }}
                        className="pulse-animation"
                      />
                    )}
                  </AnimatePresence>
                </div>
                
                <div style={{ position: 'absolute', top: '-3rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <ArrowUp style={{ color: '#006e28', opacity: 0.4 }} size={24} />
                  <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#006e28', textTransform: 'uppercase', opacity: 0.4 }}>Accept</span>
                </div>
                <div style={{ position: 'absolute', bottom: '-4rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#ba1a1a', textTransform: 'uppercase', opacity: 0.4 }}>Reject</span>
                  <ArrowDown style={{ color: '#ba1a1a', opacity: 0.4 }} size={24} />
                </div>
              </div>
            </div>

            {/* The Shop (Right) */}
            <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
              <motion.div 
                animate={showShopPulse ? { scale: [1, 1.05, 1], rotate: [0, 1, -1, 0] } : {}}
                className="shop-card"
                style={{ 
                  boxShadow: showShopPulse ? '0 0 30px rgba(114, 254, 136, 0.4)' : '0 4px 20px rgba(0,0,0,0.05)',
                  transition: 'box-shadow 0.3s ease'
                }}
              >
                <div className="shop-awning">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="awning-stripe" />
                  ))}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '0.5rem', backgroundColor: 'rgba(0,0,0,0.05)' }} />
                </div>
                <div style={{ marginTop: '2.5rem', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '9rem', height: '6rem', backgroundColor: '#eeeef0', borderRadius: '0.5rem', border: '2px solid #e2e2e4', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: '0.5rem', backgroundColor: 'rgba(0, 88, 188, 0.05)', backdropFilter: 'blur(4px)', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Store style={{ color: 'rgba(0, 88, 188, 0.3)' }} size={48} />
                    </div>
                    <AnimatePresence>
                      {showShopPulse && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 1, 0] }}
                          transition={{ duration: 0.8 }}
                          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(114, 254, 136, 0.4)', zIndex: 20, pointerEvents: 'none' }}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                  <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <motion.div 
                      animate={showShopPulse ? { scale: [1, 1.5, 1], backgroundColor: ['#0058bc', '#006e28', '#0058bc'] } : {}}
                      style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', backgroundColor: '#0058bc' }} 
                    />
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#414755' }}>TAUKE PREMIUM SHOP</span>
                  </div>
                </div>
              </motion.div>
              <div style={{ position: 'absolute', left: '-4rem', top: '50%', transform: 'translateY(-50%)', width: '8rem', height: '8rem', backgroundColor: 'rgba(0, 88, 188, 0.05)', filter: 'blur(32px)', borderRadius: '50%' }} />
            </div>
          </div>

          {/* Progress Bar Area */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: '0 2.5rem 2rem 2.5rem' }}>
            <div className="progress-container">
              <motion.div 
                className="progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <span className="label-caps" style={{ color: '#717786', marginBottom: 0 }}>{Math.round(progress)}% SYNCHRONIZED</span>
              <span className="label-caps" style={{ color: '#717786', marginBottom: 0 }}>BOUTIQUE INSTANCE: #AT-042</span>
            </div>
          </div>
        </div>

        {/* Bottom Stats */}
        <div style={{ marginTop: '4rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5rem' }}>
          <div className="chip">
            <Users style={{ color: '#0058bc' }} size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#414755' }}>Active Agents: 1,240</span>
          </div>
          <div className="chip">
            <Bolt style={{ color: '#006e28' }} size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#414755' }}>Latency: 14ms</span>
          </div>
          <div className="chip">
            <BarChart3 style={{ color: '#0058bc' }} size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#414755' }}>Logic: Atelier-v4.1</span>
          </div>
        </div>
      </main>

      {/* Navigation */}
      <nav className="nav-bar">
        <button className="nav-item active">
          <Users size={24} style={{ marginBottom: '0.25rem' }} />
          <span className="nav-label">Queue</span>
        </button>
        <button className="nav-item">
          <Briefcase size={24} style={{ marginBottom: '0.25rem' }} />
          <span className="nav-label">Vault</span>
        </button>
        <button className="nav-item">
          <ShoppingBag size={24} style={{ marginBottom: '0.25rem' }} />
          <span className="nav-label">Store</span>
        </button>
      </nav>
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .pulse-animation {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      `}</style>
    </div>
  );
}
