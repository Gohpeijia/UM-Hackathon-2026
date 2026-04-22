/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  LineChart,
  RefreshCw,
  BarChart3,
  Settings,
  HelpCircle,
  LogOut,
  Bell,
  Grid,
  ReceiptText,
  CheckCircle2,
  Database,
  Clock,
  Archive,
  AlertCircle,
  Upload,
  Search,
  ChevronDown,
  FileText,
  Package,
  Receipt,
  Loader2,
  Info,
  Sparkles
} from 'lucide-react';

export default function App() {
  const [selectedMonth, setSelectedMonth] = useState('April 2026');
  const [isMonthSelectOpen, setIsMonthSelectOpen] = useState(false);
  const [isMissingMonthSelectorOpen, setIsMissingMonthSelectorOpen] = useState(false);
  
  // Track sync states for all months
  const [allMonthsSyncStates, setAllMonthsSyncStates] = useState({
    'April 2026': {
      sales: { isSynced: false, isUploading: false },
      procurement: { isSynced: false, isUploading: false },
      invoices: { isSynced: false, isUploading: false },
    },
    'March 2026': {
      sales: { isSynced: true, isUploading: false },
      procurement: { isSynced: true, isUploading: false },
      invoices: { isSynced: true, isUploading: false },
    },
    'February 2026': {
      sales: { isSynced: false, isUploading: false },
      procurement: { isSynced: false, isUploading: false },
      invoices: { isSynced: false, isUploading: false },
    },
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [showHint, setShowHint] = useState(true);

  const months = ['April 2026', 'March 2026', 'February 2026'];
  const isCurrentMonth = selectedMonth === 'April 2026';
  
  const currentSyncStates = allMonthsSyncStates[selectedMonth];

  const handleUpload = (type) => {
    setAllMonthsSyncStates(prev => ({
      ...prev,
      [selectedMonth]: {
        ...prev[selectedMonth],
        [type]: { ...prev[selectedMonth][type], isUploading: true }
      }
    }));

    // Simulate upload delay
    setTimeout(() => {
      setAllMonthsSyncStates(prev => ({
        ...prev,
        [selectedMonth]: {
          ...prev[selectedMonth],
          [type]: { isSynced: true, isUploading: false }
        }
      }));
    }, 1500);
  };

  const handleNavigateToMonth = (month) => {
    setSelectedMonth(month);
    setIsMissingMonthSelectorOpen(false);
    setAnalysisProgress(0);
    setIsAnalyzing(false);
  };

  const handleAnalyze = () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    const interval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    setTimeout(() => {
      setIsAnalyzing(false);
    }, 3000);
  };

  const allSynced = Object.values(currentSyncStates).every(s => s.isSynced);
  
  // Find months that aren't fully synced
  const incompleteMonths = months.filter(m => 
    m !== selectedMonth && Object.values(allMonthsSyncStates[m]).some(s => !s.isSynced)
  );

  return (
    <div className="layout-root">
      {/* Side Navigation */}
      <nav className="sidebar">
        <div className="mb-4 px-4">
          <h1 className="text-lg font-black text-slate-900">Tauke.AI</h1>
          <p className="mt-1 text-xs text-slate-500">SME Intelligence</p>
        </div>
        
        <div className="flex-1 space-y-2">
          <NavItem icon={LayoutDashboard} label="Dashboard" />
          <NavItem icon={LineChart} label="Insights" />
          <NavItem icon={RefreshCw} label="Data Sync" active />
          <NavItem icon={BarChart3} label="Reporting" />
          <NavItem icon={Settings} label="Settings" />
        </div>

        <div className="space-y-2 border-t border-slate-200/50 pt-6">
          <NavItem icon={HelpCircle} label="Support" />
          <NavItem icon={LogOut} label="Sign Out" />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Header */}
        <header className="top-header">
          <div className="md:hidden">
            <span className="text-xl font-bold tracking-tight text-slate-900">Tauke.AI</span>
          </div>
          <div className="hidden flex-1 md:flex"></div>
          
          <div className="flex items-center space-x-4">
            <IconButton icon={Bell} />
            <IconButton icon={Grid} />
            <div className="ml-2 h-8 w-8 overflow-hidden rounded-full border border-outline-variant/30 bg-surface-container-high">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCrThSFQqyIjmMSEtaUkgkvZqJiNSz5bLAY_IR6XiBUbL5Z0tK1c1VEyqSe6Xz2_vx-mxz9sb-YADizV2t09H5PuOEovZ5dvG1QIwb6jSV2wWjYtBU-dpe2P-i2-CkU-hvxIUWwFOIpWWsVrqB123zAb5pmlvV9OkEV7yMVlzqyUxsujrKskkQTTbu61PyUymAcfJZa4rdjMsyD0-T_0VR5IU6vezIeJ-6i0wI16--vE1cYWQbuoGYhG5s8OFWhjRabPISZdWg-iDvI" 
                alt="Profile" 
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </header>

        {/* Scrollable Container */}
        <div className="page-container">
          <div className="content-wrapper">
            
            {/* Page Header and Month Picker */}
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <h2 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-on-surface md:text-5xl">
                  Data Intelligence Hub
                </h2>
                <p className="max-w-xl text-lg text-on-surface-variant">
                  Synthesize your enterprise data for predictive modeling.
                </p>
              </div>

              {/* Month Dropdown Selection */}
              <div className="relative">
                <button 
                  onClick={() => setIsMonthSelectOpen(!isMonthSelectOpen)}
                  className="flex items-center space-x-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 shadow-sm transition-all hover:bg-surface-container-low"
                >
                  <span className="text-sm font-bold text-on-surface">{selectedMonth}</span>
                  <ChevronDown className={`h-4 w-4 text-outline transition-transform ${isMonthSelectOpen ? 'rotate-180' : ''}`} />
                </button>
                
                <AnimatePresence>
                  {isMonthSelectOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-lg z-50"
                    >
                      {months.map((month) => (
                        <button
                          key={month}
                          onClick={() => {
                            setSelectedMonth(month);
                            setIsMonthSelectOpen(false);
                            setAnalysisProgress(0);
                            setIsAnalyzing(false);
                          }}
                          className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-surface-active ${selectedMonth === month ? 'bg-primary/5 font-bold text-primary' : 'text-on-surface'}`}
                        >
                          {month}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Subtle Optional Hint for missing months */}
            <AnimatePresence>
              {showHint && isCurrentMonth && incompleteMonths.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-2xl border border-primary/10 bg-primary/5 p-5 ambient-shadow"
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 pt-1">
                      <h4 className="text-sm font-bold text-on-surface">Maximize Insight Quality</h4>
                      <p className="mt-1 text-sm text-on-surface-variant leading-relaxed">
                        Some historical data is currently missing. While {selectedMonth} analysis is ready, 
                        providing past records allows the AI to detect deeper quarterly trends for a more accurate forecast.
                      </p>
                      <div className="mt-3 flex items-center space-x-4 relative">
                        <div className="relative">
                          <button 
                            onClick={() => setIsMissingMonthSelectorOpen(!isMissingMonthSelectorOpen)}
                            className="flex items-center space-x-1 text-sm font-bold text-primary hover:underline"
                          >
                            <span>Fill missing record</span>
                            <ChevronDown className={`h-3 w-3 transition-transform ${isMissingMonthSelectorOpen ? 'rotate-180' : ''}`} />
                          </button>
                          
                          <AnimatePresence>
                            {isMissingMonthSelectorOpen && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute left-0 mt-2 w-48 overflow-hidden rounded-xl bg-white border border-outline-variant/30 shadow-xl z-[60]"
                              >
                                <div className="px-3 py-2 border-b border-outline-variant/10">
                                  <span className="text-[10px] font-black uppercase text-slate-400">Missing Periods</span>
                                </div>
                                {incompleteMonths.map(month => (
                                  <button
                                    key={month}
                                    onClick={() => handleNavigateToMonth(month)}
                                    className="w-full px-4 py-3 text-left text-sm text-on-surface hover:bg-slate-50 transition-colors flex items-center justify-between group"
                                  >
                                    <span>{month}</span>
                                    <div className="h-2 w-2 rounded-full bg-tertiary transition-transform group-hover:scale-125" />
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        
                        <button 
                          onClick={() => setShowHint(false)}
                          className="text-sm font-medium text-outline hover:text-on-surface transition-colors"
                        >
                          Dismiss for now
                        </button>
                      </div>
                    </div>
                    <Info className="h-4 w-4 text-outline/40" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bento Grid layout */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              
              {/* Card 1: Sales & Transactions */}
              <SyncCard 
                title="Sales & Transactions"
                format="(CSV)"
                description="Historical POS records and daily transaction logs."
                icon={ReceiptText}
                isSynced={currentSyncStates.sales.isSynced}
                isUploading={currentSyncStates.sales.isUploading}
                onUpload={() => handleUpload('sales')}
                rows="13,426"
                lastUpdate={currentSyncStates.sales.isSynced ? "Today, 09:41 AM" : null}
                colSpan="lg:col-span-12"
                accentColor="secondary"
              />

              {/* Card 2: Monthly Statement (Split Part 1) */}
              <SyncCard 
                title="Monthly Statement" 
                format="(PDF)"
                description={currentSyncStates.procurement.isSynced ? "All supplier ledgers are verified and reconciled." : "Awaiting period ledger for cost validation."}
                icon={Package}
                isSynced={currentSyncStates.procurement.isSynced}
                isUploading={currentSyncStates.procurement.isUploading}
                onUpload={() => handleUpload('procurement')}
                errorMsg={!currentSyncStates.procurement.isSynced ? `Awaiting ${selectedMonth.split(' ')[0]} Supplier Ledger` : undefined}
                colSpan="lg:col-span-6"
                accentColor="error"
              />

              {/* Card 3: Invoice Management (Split Part 2) */}
              <SyncCard 
                title="Invoice Management" 
                format="(PDF)"
                description={currentSyncStates.invoices.isSynced ? "Monthly invoicing data processed and stored." : "Internal invoicing data incomplete for this period."}
                icon={Receipt}
                isSynced={currentSyncStates.invoices.isSynced}
                isUploading={currentSyncStates.invoices.isUploading}
                onUpload={() => handleUpload('invoices')}
                errorMsg={!currentSyncStates.invoices.isSynced ? `Missing ${selectedMonth.split(' ')[0]} Transaction Invoices` : undefined}
                colSpan="lg:col-span-6"
                accentColor="error"
              />

              {/* Action Section: Data Analysis Pipeline */}
              <div className="col-span-1 lg:col-span-12">
                <div className="card">
                   <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <LineChart className="h-5 w-5 text-primary" />
                        <h3 className="text-xl font-bold text-on-surface">Data Analysis Pipeline</h3>
                      </div>
                      <p className="text-sm text-on-surface-variant">
                        {!allSynced 
                          ? "Pipeline paused. Integrated intelligence requires all data sources to be present." 
                          : isAnalyzing 
                            ? `Analysis in progress... ${analysisProgress}%`
                            : "Pipeline active. You have enough data to initiate deep learning analysis."}
                      </p>
                      {isAnalyzing && (
                        <div className="mt-4 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-surface-container-high">
                          <motion.div 
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${analysisProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    
                    <button 
                      onClick={handleAnalyze}
                      disabled={!allSynced || isAnalyzing}
                      className="btn btn-analyze md:w-auto relative overflow-hidden"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Analysing...</span>
                        </>
                      ) : (
                        <>
                          <Search className="h-5 w-5" />
                          <span>Ready to analyse?</span>
                        </>
                      )}
                    </button>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, active = false }) {
  return (
    <a 
      href="#" 
      className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
        active 
          ? 'bg-white text-primary font-bold shadow-sm' 
          : 'text-slate-500 font-medium hover:text-primary'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="font-sans text-[10px] uppercase tracking-[0.05em]">{label}</span>
    </a>
  );
}

function IconButton({ icon: Icon }) {
  return (
    <button className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100/50">
      <Icon className="h-5 w-5" />
    </button>
  );
}

function SyncCard({ 
  title, 
  format, 
  description, 
  icon: Icon, 
  isSynced,
  isUploading,
  onUpload,
  rows, 
  lastUpdate, 
  errorMsg, 
  colSpan, 
  accentColor 
}) {
  return (
    <div className={`${colSpan} card`}>
      {/* Dynamic line color based on sync status */}
      <div className={`absolute top-0 left-0 h-1 w-full transition-colors duration-500 ${
        isSynced ? 'bg-secondary' : 'bg-tertiary'
      }`} />
      
      <div className="mb-6 flex items-start justify-between">
        <div className={`card-header-icon ${accentColor === 'error' ? 'text-error' : 'text-on-surface'}`}>
          <Icon className="h-6 w-6" />
        </div>
        
        <div className={`badge ${isSynced ? 'badge-synced' : 'badge-action'}`}>
          {isSynced ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          <span>{isSynced ? 'Synced' : 'Action Required'}</span>
        </div>
      </div>

      <h3 className="mb-2 text-xl font-bold text-on-surface">
        {title} <span className="ml-1 text-sm font-normal text-on-surface-variant">{format}</span>
      </h3>
      
      {errorMsg && <p className="mb-1 text-sm font-medium text-error">{errorMsg}</p>}
      <p className="mb-8 text-sm text-on-surface-variant leading-relaxed">{description}</p>

      {isSynced ? (
        <div className="space-y-4">
          {rows && (
            <div className="stat-row">
              <div className="flex items-center space-x-3">
                <Database className="h-4 w-4 text-outline" />
                <span className="text-sm font-medium text-on-surface">Rows Parsed</span>
              </div>
              <span className="text-sm font-bold text-on-surface">{rows}</span>
            </div>
          )}
          {lastUpdate && (
            <div className="stat-row">
              <div className="flex items-center space-x-3">
                <Clock className="h-4 w-4 text-outline" />
                <span className="text-sm font-medium text-on-surface">Last Update</span>
              </div>
              <span className="text-sm font-medium text-on-surface-variant font-mono text-xs">{lastUpdate}</span>
            </div>
          )}
          {!rows && !lastUpdate && (
             <div className="stat-row border border-outline-variant/15">
               <div className="flex items-center space-x-3">
                 <FileText className="h-4 w-4 text-outline" />
                 <span className="text-sm font-medium text-on-surface">Period Consistency Check</span>
               </div>
               <CheckCircle2 className="h-4 w-4 text-secondary" />
             </div>
          )}
        </div>
      ) : (
        <button 
          onClick={onUpload}
          disabled={isUploading}
          className="btn btn-upload group"
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Upload className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
          )}
          <span>{isUploading ? 'Uploading...' : 'Upload Missing File'}</span>
        </button>
      )}
    </div>
  );
}
