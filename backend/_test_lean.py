"""Test lean prompt timing — must finish under 30s."""
import os, json, requests, time
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from dotenv import find_dotenv, load_dotenv
load_dotenv(find_dotenv(), override=True)

ILMU_API_KEY = os.getenv("ILMU_API_KEY")

system_prompt = (
    "You are MicroFish, an F&B swarm-intelligence simulator. "
    "Analyze the scenario using the merchant data and live signals. "
    "Return ONLY valid JSON (no markdown) with these keys:\n"
    "- simulation_summary: 2 sentences referencing the signal data\n"
    "- financial_analysis: {baseline_estimated_profit, projected_new_profit, profit_boost, final_verdict: PROCEED/AVOID}\n"
    "- operational_impact: {can_handle_traffic: bool, bottleneck_risk: Low/Moderate/High, operational_notes}\n"
    "- swarm_behavior: array of audience segments [{segment, reaction, churn_risk: Low/Medium/High}]"
)

user_prompt = (
    'Scenario: "Launch Buy-1-Free-1 during Friday lunch"\n'
    "Shop: Cafe | Mid-range | Hours: 8am-10pm\n"
    'Audience: {"students": 40, "office_workers": 40, "tourists": 20}\n'
    'Financials: {"rev": 25000, "profit": 4500, "avg_rev": 22000}\n'
    'Signals: {"weather": "Sunny, 32°C", "traffic": "moderate", "foot_traffic": 65, "competitors": 5}\n'
    "JSON only."
)

print(f"System: {len(system_prompt)} chars")
print(f"User: {len(user_prompt)} chars")
print(f"Total: {len(system_prompt) + len(user_prompt)} chars\n")

t0 = time.time()
resp = requests.post(
    "https://api.ilmu.ai/v1/chat/completions",
    headers={"Authorization": f"Bearer {ILMU_API_KEY}", "Content-Type": "application/json"},
    json={
        "model": "ilmu-glm-5.1",
        "temperature": 0.4,
        "max_tokens": 3000,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    },
    timeout=90,
)
elapsed = time.time() - t0

print(f"HTTP {resp.status_code} in {elapsed:.1f}s")
if resp.ok:
    data = resp.json()
    choices = data.get("choices", [])
    first_choice = choices[0] if choices else {}
    message = first_choice.get("message", {}) or {}
    content = message.get("content")
    usage = data.get("usage", {})

    print(f"Tokens: in={usage.get('prompt_tokens')}, out={usage.get('completion_tokens')}, total={usage.get('total_tokens')}")
    print(f"finish_reason: {first_choice.get('finish_reason')!r}")
    print(f"content type: {type(content).__name__} | value: {repr(content)[:200] if content is not None else 'NULL'}")

    # Show full first_choice keys so we can see where content lives
    print(f"first_choice keys: {list(first_choice.keys())}")
    print(f"message keys: {list(message.keys()) if isinstance(message, dict) else message}")

    # Try all fallback locations
    text_output = None
    for source, val in [
        ("message.content", content),
        ("message.reasoning_content", message.get("reasoning_content")),
        ("choice.text", first_choice.get("text")),
        ("payload.output_text", data.get("output_text")),
    ]:
        if val and isinstance(val, str) and val.strip():
            text_output = val.strip()
            print(f"Found text in: {source} ({len(text_output)} chars)")
            break

    if not text_output:
        print("ERROR: No text found in any known field. Full first_choice:")
        import json as _j
        print(_j.dumps(first_choice, indent=2, default=str)[:800])
    else:
        print(f"Raw ({len(text_output)} chars):\n{text_output[:400]}")
        from vision_service import _extract_json_from_text, _repair_truncated_json
        extracted = _extract_json_from_text(text_output)
        try:
            parsed = __import__('json').loads(extracted)
        except Exception:
            repaired = _repair_truncated_json(extracted)
            parsed = __import__('json').loads(repaired)
            print("[Repair used]")
        print(f"\nKeys: {list(parsed.keys())}")
        print(f"Segments: {len(parsed.get('swarm_behavior', []))}")
        print(f"Verdict: {parsed.get('financial_analysis', {}).get('final_verdict')}")
        print(f"Summary: {str(parsed.get('simulation_summary', ''))[:120]}")
        print(f"\n{'PASS' if elapsed < 60 else 'FAIL'} - {elapsed:.1f}s")
else:
    print(f"FAILED: {resp.text[:300]}")

