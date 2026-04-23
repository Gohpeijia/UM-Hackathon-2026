import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./SupervisorClarification.css";
import { API_BASE_URL } from "../config";

const navItems = [
    { label: "Store Setup", icon: "storefront", to: "/store-configuration" },
    { label: "Data Sync", icon: "sync", to: "/data-sync" },
    { label: "Analysis", icon: "insights", to: "/detective-analysis" },
    { label: "Clarification", icon: "forum", to: "/supervisor-clarification", active: true },
    { label: "War Room", icon: "groups", to: "/ai-debate" },
    { label: "Strategy Synthesis", icon: "hub", to: "/final-synthesis" }
];

export default function SupervisorClarification() {
    const navigate = useNavigate();
    const [notes, setNotes] = useState("");
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [historicalContext, setHistoricalContext] = useState(null);
    const [externalSignal, setExternalSignal] = useState(null);

    const ownerId = localStorage.getItem("owner_id");
    const targetMonth = localStorage.getItem("target_month") || "2026-04";

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/boardroom/start`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        merchant_id: ownerId,
                        target_month: targetMonth
                    })
                });
                const data = await response.json();

                if (data.analyst_questions) {
                    const questionLines = data.analyst_questions
                        .split("\n")
                        .map(q => q.replace(/^\d+[\.\)\s]+/, "").trim())
                        .filter(q => q.length > 5);

                    setQuestions(questionLines);
                    localStorage.setItem("boardroom_questions", JSON.stringify(questionLines));
                    localStorage.setItem("boardroom_financial_context", JSON.stringify(data.financial_context || {}));
                    localStorage.setItem("boardroom_financial_trend", JSON.stringify(data.financial_trend || {}));
                    localStorage.setItem("boardroom_diagnostic_patterns", JSON.stringify(data.diagnostic_patterns || {}));

                    // Parse dynamic context cards from financial data
                    const diagPatterns = data.diagnostic_patterns || {};
                    const finTrend = data.financial_trend || {};

                    // Build Historical Context from real data
                    const prevRevenue = finTrend.previous_month_revenue;
                    const currRevenue = finTrend.current_month_revenue;
                    if (prevRevenue && currRevenue) {
                        const delta = ((currRevenue - prevRevenue) / prevRevenue * 100).toFixed(1);
                        const direction = delta >= 0 ? "increase" : "drop";
                        setHistoricalContext(`Revenue showed a ${Math.abs(delta)}% ${direction} compared to the previous month (RM${Math.round(prevRevenue).toLocaleString()} → RM${Math.round(currRevenue).toLocaleString()}).`);
                    } else if (diagPatterns.revenue_trend) {
                        setHistoricalContext(`Revenue trend: ${diagPatterns.revenue_trend}`);
                    }

                    // Build Supply Signal from diagnostic patterns
                    const topItems = diagPatterns.top_selling_items || diagPatterns.declining_items || [];
                    if (Array.isArray(topItems) && topItems.length > 0) {
                        setExternalSignal(`Top performing item: "${topItems[0]}" — monitor stock levels to prevent a supply gap during recovery.`);
                    } else if (diagPatterns.alert) {
                        setExternalSignal(diagPatterns.alert);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch boardroom questions:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchQuestions();
    }, []);

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setNotes("");
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const existingAnswers = localStorage.getItem("boss_answers") || "";
        const currentQ = questions[currentQuestionIndex] || "General context";
        const combined = existingAnswers
            ? `${existingAnswers}\nQ: ${currentQ}\nA: ${notes}`
            : `Q: ${currentQ}\nA: ${notes}`;
        localStorage.setItem("boss_answers", combined);

        if (currentQuestionIndex < questions.length - 1) {
            handleNext();
        } else {
            navigate("/ai-debate");
        }
    };

    const currentQuestion = questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const totalQuestions = questions.length;

    return (
        <div className="clarification-page">
            <main className="clarification-main">
                <div className="clarification-shell">
                    <header className="clarification-header">
                        <p className="step-label">Step 5 / Supervisor Agent</p>
                        <h2 className="page-title">Clarification Request</h2>
                        <p className="page-subtitle">The AI needs your confirmation before proceeding with strategic synthesis.</p>
                    </header>

                    <section className="featured-clarification-card" aria-label="Clarification card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <span className="status-pill">
                                <span className="material-symbols-outlined" aria-hidden="true">priority_high</span>
                                Action Required
                            </span>
                            {totalQuestions > 1 && (
                                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                                    Question {currentQuestionIndex + 1} of {totalQuestions}
                                </span>
                            )}
                        </div>

                        <h3 className="question-title">
                            {isLoading ? "AI is analyzing your data..." : currentQuestion ?? "Analyzing anomalies in your data..."}
                        </h3>
                        <p className="question-subtitle">Your confirmation improves forecasting accuracy and aligns strategic next actions.</p>

                        <form className="clarification-form" onSubmit={handleSubmit}>
                            <div className="response-option response-other" style={{ width: '100%', cursor: 'default' }}>
                                <div className="response-card" style={{ padding: '24px' }}>
                                    <div className="response-copy" style={{ width: '100%' }}>
                                        <h4>Your Context</h4>
                                        <p>Type your answer to the AI's question above.</p>
                                        <div className="response-extra" style={{ paddingLeft: '0', marginTop: '16px' }}>
                                            <textarea
                                                rows="4"
                                                placeholder="Provide your answer here..."
                                                value={notes}
                                                onChange={(event) => setNotes(event.target.value)}
                                                style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '15px' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="clarification-actions">
                                <button type="button" className="secondary-button" onClick={() => navigate("/ai-debate")}>
                                    Skip to War Room
                                </button>
                                <button type="submit" className="primary-button" disabled={isLoading}>
                                    <span>{isLastQuestion ? "Continue to War Room" : "Next Question"}</span>
                                    <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="support-cards" aria-label="Supporting context">
                        <article className="support-card">
                            <div className="support-icon" aria-hidden="true">
                                <span className="material-symbols-outlined">history</span>
                            </div>
                            <div>
                                <h4>Historical Context</h4>
                                <p>
                                    {isLoading
                                        ? "Loading trend analysis..."
                                        : historicalContext || "Revenue pattern analysis in progress."}
                                </p>
                            </div>
                        </article>

                        <article className="support-card">
                            <div className="support-icon" aria-hidden="true">
                                <span className="material-symbols-outlined">inventory_2</span>
                            </div>
                            <div>
                                <h4>Supply Signals</h4>
                                <p>
                                    {isLoading
                                        ? "Loading supply signals..."
                                        : externalSignal || "Supply chain indicators are being analyzed."}
                                </p>
                            </div>
                        </article>
                    </section>
                </div>
            </main>
        </div>
    );
}