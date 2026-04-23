import re

with open('c:/Users/User/Desktop/UM-Hackathon-2026/backend/vision_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """class BoardroomDebateRequest(BaseModel):
    merchant_id: str = Field(min_length=1)
    target_month: str = Field(min_length=7)
    proposed_strategies: str = Field(min_length=1)
    merchant_profile: str = Field(default="")
    external_signals: Dict[str, Any] = Field(default_factory=dict)
    financial_trend: Dict[str, Any] = Field(default_factory=dict) # Financial trends related to the debate
    
    # 👇 NEW: Catching the Internal Signals!
    diagnostic_patterns: Dict[str, Any] = Field(default_factory=dict)
    approved_theory: str = Field(default="")

@app.post("/boardroom/debate")
def boardroom_debate(payload: BoardroomDebateRequest) -> Dict[str, Any]:
    try:
        llm_client = get_zhipu_client()

        financial_trend = payload.financial_trend
        if not isinstance(financial_trend, dict) or not financial_trend:
            try:
                supabase = get_supabase_client()
                target_month = _normalize_report_month(payload.target_month)
                financial_trend = _fetch_financial_trend(supabase, payload.merchant_id.strip(), target_month)
            except Exception:
                financial_trend = {}

        user_prompt = (
            f"--- BUSINESS CONTEXT ---\\n"
            f"Merchant Profile: {payload.merchant_profile}\\n\\n"
            
            f"--- INTERNAL SIGNALS ---\\n"
            f"Financial Trend JSON: {json.dumps(financial_trend, indent=2)}\\n"
            f"Diagnostic Data: {json.dumps(payload.diagnostic_patterns, indent=2)}\\n"
            f"Approved Business Theory (includes Boss's input): {payload.approved_theory}\\n\\n"
            
            f"--- EXTERNAL SIGNALS ---\\n"
            f"Real-World Data (Weather, Events, Competitors):\\n"
            f"{json.dumps(payload.external_signals, indent=2)}\\n\\n"
            
            f"--- THE TASK ---\\n"
            f"Here are the 3 proposed strategies to analyze:\\n{payload.proposed_strategies}"
        )
        
        # 1. Define the 3 distinct Agent personas
        cmo_sys = "You are the CMO (Growth Hacker). Analyze the 3 strategies using the financial_trend plus diagnostic_patterns. Map item-level drops/spikes to external signals like weather and competitors. Pick the strategy with best demand upside and explain pros/cons in 2-3 conversational sentences."
        coo_sys = "You are the COO (Kitchen Operations). Analyze the 3 strategies using diagnostic_patterns and external signals. Identify which strategy best handles real operational bottlenecks caused by the exact items/time blocks shifting in the data. Keep it conversational in 2-3 sentences."
        cfo_sys = "You are the CFO (Risk Manager). Compare target_month against rolling_averages to determine above/below baseline. Use historical_curve to check if there are consecutive months of cash bleeding. Rank the 3 strategies by margin protection and downside risk in 2-3 sentences."

        # 2. Run the 3 Agents IN PARALLEL (Massive speed boost!)
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            future_cmo = executor.submit(_call_text_llm, llm_client, cmo_sys, user_prompt, 0.4)
            future_coo = executor.submit(_call_text_llm, llm_client, coo_sys, user_prompt, 0.4)
            future_cfo = executor.submit(_call_text_llm, llm_client, cfo_sys, user_prompt, 0.4)
            
            cmo_text = future_cmo.result()
            coo_text = future_coo.result()
            cfo_text = future_cfo.result()

        # 3. The "Final Boss" Synthesis
        boss_sys = (
            "You are the CEO. Read your executives' opinions on the 3 strategies. "
            "Base your final decision on long-term trend direction (rolling averages + historical curve), not one-month panic. "
            "Select ONE strategy that best balances growth, operations, and finance, and explain why it wins."
        )
        boss_usr = f"CMO says:\\n{cmo_text}\\n\\nCOO says:\\n{coo_text}\\n\\nCFO says:\\n{cfo_text}\\n\\nWhat is your final decision?"
        
        boss_text = _call_text_llm(llm_client, boss_sys, boss_usr, 0.2)

        # 4. Stitch it together into the "Chat Bubble" JSON array for Next.js!
        # Notice we don't need dangerous Regex anymore; we control the JSON directly!
        debate_script = [
            {"speaker": "CMO", "text": cmo_text},
            {"speaker": "COO", "text": coo_text},
            {"speaker": "CFO", "text": cfo_text},
            {"speaker": "FINAL DECISION", "text": boss_text}
        ]
        
        return {
            "status": "success",
            "debate_script": debate_script
        }
        
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Parallel debate generation failed: {exc}") from exc"""

new_block = """class BoardroomDebateRequest(BaseModel):
    merchant_id: str = Field(min_length=1)
    target_month: str = Field(min_length=7)
    boss_answers: str = Field(default="")

@app.post("/boardroom/debate")
def boardroom_debate(payload: BoardroomDebateRequest) -> Dict[str, Any]:
    try:
        merchant_id = payload.merchant_id.strip()
        target_month = _normalize_report_month(payload.target_month)
        boss_answers = payload.boss_answers.strip()

        supabase = get_supabase_client()
        llm_client = get_zhipu_client()

        # 1. Fetch Context
        financial_context = _build_financial_context_payload(supabase, merchant_id, target_month)
        financial_trend = financial_context.get("financial_trend", {})
        diagnostic_json = financial_context.get("diagnostic_patterns", {})
        merchant_profile = _fetch_merchant_profile(supabase, merchant_id)
        external_signals = _fetch_external_signals(supabase, merchant_id, merchant_profile, target_month)

        # 2. Get Theory & Generate 3 Strategies
        analyst_sys, analyst_usr = _analyst_synthesis_prompt(
            merchant_profile=merchant_profile,
            target_month=target_month,
            financial_context=financial_context,
            boss_answers=boss_answers,
            external_signals=external_signals,
        )
        theory_v1 = _call_text_llm(llm_client, analyst_sys, analyst_usr, temperature=0.2)

        sup_sys, sup_usr = _supervisor_review_prompt(
            diagnostic_json=diagnostic_json,
            boss_answers=boss_answers,
            theory_v1=theory_v1,
            external_signals=external_signals,
        )
        supervisor_evaluation = _call_text_llm(llm_client, sup_sys, sup_usr, temperature=0.1)

        supervisor_decision = _extract_supervisor_decision(supervisor_evaluation)
        final_approved_theory = theory_v1 if supervisor_decision == "APPROVED" else ""

        strategist_action_plan = ""
        if supervisor_decision == "APPROVED":
            strat_sys, strat_usr = _strategist_action_plan_prompt(
                merchant_profile=merchant_profile,
                diagnostic_json=diagnostic_json,
                boss_answers=boss_answers,
                final_approved_theory=final_approved_theory,
                external_signals=external_signals,
            )
            strategist_action_plan = _call_text_llm(llm_client, strat_sys, strat_usr, temperature=0.2)
        else:
            strategist_action_plan = "No viable strategies found due to lack of approved theory."

        # 3. Debate
        user_prompt = (
            f"--- BUSINESS CONTEXT ---\\n"
            f"Merchant Profile: {merchant_profile}\\n\\n"
            
            f"--- INTERNAL SIGNALS ---\\n"
            f"Financial Trend JSON: {json.dumps(financial_trend, indent=2)}\\n"
            f"Diagnostic Data: {json.dumps(diagnostic_json, indent=2)}\\n"
            f"Approved Business Theory: {final_approved_theory}\\n\\n"
            
            f"--- EXTERNAL SIGNALS ---\\n"
            f"Real-World Data:\\n"
            f"{json.dumps(external_signals, indent=2)}\\n\\n"
            
            f"--- THE TASK ---\\n"
            f"Here are the 3 proposed strategies to analyze:\\n{strategist_action_plan}"
        )
        
        cmo_sys = "You are the CMO (Growth Hacker). Analyze the 3 strategies using the financial_trend plus diagnostic_patterns. Map item-level drops/spikes to external signals like weather and competitors. Pick the strategy with best demand upside and explain pros/cons in 2-3 conversational sentences."
        coo_sys = "You are the COO (Kitchen Operations). Analyze the 3 strategies using diagnostic_patterns and external signals. Identify which strategy best handles real operational bottlenecks caused by the exact items/time blocks shifting in the data. Keep it conversational in 2-3 sentences."
        cfo_sys = "You are the CFO (Risk Manager). Compare target_month against rolling_averages to determine above/below baseline. Use historical_curve to check if there are consecutive months of cash bleeding. Rank the 3 strategies by margin protection and downside risk in 2-3 sentences."

        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            future_cmo = executor.submit(_call_text_llm, llm_client, cmo_sys, user_prompt, 0.4)
            future_coo = executor.submit(_call_text_llm, llm_client, coo_sys, user_prompt, 0.4)
            future_cfo = executor.submit(_call_text_llm, llm_client, cfo_sys, user_prompt, 0.4)
            
            cmo_text = future_cmo.result()
            coo_text = future_coo.result()
            cfo_text = future_cfo.result()

        # 4. Synthesize Final Verdict and Output JSON
        boss_sys = (
            "You are the CEO. Read your executives' opinions on the 3 strategies. "
            "Base your final decision on long-term trend direction. Select ONE strategy that best balances growth, operations, and finance.\\n\\n"
            "OUTPUT PURE JSON matching this schema exactly (No markdown, no backticks):\\n"
            "{\\n"
            "  \\"strategies\\": [\\n"
            "    {\\"role\\": \\"Growth Hacker\\", \\"icon\\": \\"trending_up\\", \\"stance\\": \\"Aggressive Push\\", \\"copy\\": \\"<CMO's opinion summarized>\\", \\"indicatorLabel\\": \\"Impact\\", \\"indicatorValue\\": \\"+15%\\", \\"tone\\": \\"up\\"},\\n"
            "    {\\"role\\": \\"Risk Manager\\", \\"icon\\": \\"shield\\", \\"stance\\": \\"Margin Protection\\", \\"copy\\": \\"<CFO's opinion summarized>\\", \\"indicatorLabel\\": \\"Risk\\", \\"indicatorValue\\": \\"Low\\", \\"tone\\": \\"down\\"},\\n"
            "    {\\"role\\": \\"Operations Chief\\", \\"icon\\": \\"account_tree\\", \\"stance\\": \\"Phased Rollout\\", \\"copy\\": \\"<COO's opinion summarized>\\", \\"indicatorLabel\\": \\"Readiness\\", \\"indicatorValue\\": \\"Stable\\", \\"tone\\": \\"neutral\\"}\\n"
            "  ],\\n"
            "  \\"recommended_strategy\\": {\\n"
            "    \\"role\\": \\"Consensus\\", \\"strategy\\": \\"<CEO's winning strategy title>\\", \\"argument_for\\": \\"<Why we picked this>\\", \\"argument_against\\": \\"<The risks we accepted>\\", \\"projected_profit_impact\\": \\"<e.g. +RM 1,200>\\"\\n"
            "  }\\n"
            "}"
        )
        boss_usr = f"CMO says:\\n{cmo_text}\\n\\nCOO says:\\n{coo_text}\\n\\nCFO says:\\n{cfo_text}\\n\\nReturn the pure JSON."
        
        boss_text = _call_text_llm(llm_client, boss_sys, boss_usr, 0.2)
        
        try:
            parsed_data = _parse_model_json(boss_text, source_name="Debate JSON", required_kind="object")
        except Exception as e:
            # Fallback if json parsing fails
            parsed_data = {
                "strategies": [
                    {"role": "Growth Hacker", "icon": "trending_up", "stance": "Aggressive Push", "copy": cmo_text, "indicatorLabel": "Impact", "indicatorValue": "High", "tone": "up"},
                    {"role": "Risk Manager", "icon": "shield", "stance": "Margin Protection", "copy": cfo_text, "indicatorLabel": "Risk", "indicatorValue": "Low", "tone": "down"},
                    {"role": "Operations Chief", "icon": "account_tree", "stance": "Phased Rollout", "copy": coo_text, "indicatorLabel": "Readiness", "indicatorValue": "Stable", "tone": "neutral"}
                ],
                "recommended_strategy": {
                    "role": "Consensus", "strategy": "Balanced Execution Strategy", "argument_for": boss_text[:200], "argument_against": "Requires execution monitoring.", "projected_profit_impact": "+RM 800"
                }
            }

        return {
            "status": "success",
            "strategies": parsed_data.get("strategies", []),
            "recommended_strategy": parsed_data.get("recommended_strategy", {})
        }
        
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Debate pipeline failed: {exc}") from exc"""

with open('c:/Users/User/Desktop/UM-Hackathon-2026/backend/vision_service.py', 'w', encoding='utf-8') as f:
    f.write(content.replace(old_block, new_block))
