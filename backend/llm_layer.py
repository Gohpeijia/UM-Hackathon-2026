#which call the api file then import to vision_service.py

"""
llm_layer.py  —  Single OpenRouter API key, two models, Gemini vision stays.
=============================================================================
Priority chain (text only):
  1. OpenRouter  →  meta-llama/llama-3.3-70b-instruct:free   (fast, Groq-quality)
  2. OpenRouter  →  qwen/qwen3.6-plus-preview:free            (fallback, 1M ctx)
  3. Gemini text                                               (last resort)

Vision (_vision_json) is UNCHANGED — Gemini handles all image/PDF OCR.

Required .env:
  OPENROUTER_API_KEY=sk-or-...
  GEMINI_API_KEY=AIza...              ← keep for vision

Optional overrides:
  OPENROUTER_PRIMARY_MODEL=meta-llama/llama-3.3-70b-instruct:free
  OPENROUTER_FALLBACK_MODEL=qwen/qwen3.6-plus-preview:free
  OPENROUTER_REFERER=https://tauke-ai.vercel.app
"""

import os
import time
import requests
from typing import Any
from fastapi import HTTPException


class _RateLimitError(Exception):
    """Signals a 429 so the caller can switch to the next model."""


def _call_openrouter(
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int = 3000,
    timeout: int = 60,
) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is not set in .env")

    referer = os.getenv("OPENROUTER_REFERER", "https://tauke-ai.vercel.app")

    resp = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": referer,
            "X-Title": "TaukeAI",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
        timeout=timeout,
    )

    if resp.status_code == 429:
        raise _RateLimitError(f"OpenRouter 429 on {model}: {resp.text[:200]}")

    if not resp.ok:
        raise ValueError(f"OpenRouter HTTP {resp.status_code} on {model}: {resp.text[:300]}")

    data = resp.json()

    # OpenRouter sometimes wraps errors in a 200 with an "error" key
    if "error" in data:
        msg = str(data["error"])
        if "429" in msg or "rate" in msg.lower() or "quota" in msg.lower():
            raise _RateLimitError(f"OpenRouter quota error on {model}: {msg}")
        raise ValueError(f"OpenRouter error on {model}: {msg}")

    choices = data.get("choices") or []
    if not choices:
        raise ValueError(f"OpenRouter returned no choices for {model}: {data}")

    first = choices[0]
    text = (first.get("message") or {}).get("content") or first.get("text") or ""
    finish = str(first.get("finish_reason", "")).lower()

    if finish in {"content_filter", "sensitive", "blocked"}:
        raise ValueError(f"OpenRouter blocked response (finish_reason={finish}) for {model}")

    if not text:
        raise ValueError(f"OpenRouter returned empty content for {model} (finish={finish!r})")

    return text.strip()


def _call_gemini_text(system_prompt: str, user_prompt: str, temperature: float) -> str:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    model = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    resp = requests.post(
        url,
        headers={"Content-Type": "application/json"},
        json={
            "contents": [{"role": "user", "parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]}],
            "generationConfig": {"temperature": temperature, "maxOutputTokens": 3000},
        },
        timeout=60,
    )

    if resp.status_code == 429:
        raise _RateLimitError(f"Gemini 429: {resp.text[:200]}")
    if not resp.ok:
        raise ValueError(f"Gemini HTTP {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise ValueError(f"Gemini returned no candidates: {data}")

    parts = candidates[0].get("content", {}).get("parts", [])
    text = parts[0].get("text", "") if parts else ""
    if not text:
        raise ValueError("Gemini returned empty text")
    return text.strip()

def _call_zhipu_text(system_prompt: str, user_prompt: str, temperature: float) -> str:
    api_key = os.getenv("ZHIPU_API_KEY")
    if not api_key:
        raise ValueError("ZHIPU_API_KEY not set")

    # Initialize the Zhipu client
    client = zhipuai.ZhipuAI(api_key=api_key)
    
    try:
        response = client.chat.completions.create(
            model="glm-4-flash", # Or whichever GLM model you prefer
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=temperature,
            max_tokens=3000,
            timeout=60
        )
        text = response.choices[0].message.content
        if not text:
            raise ValueError("Zhipu returned empty text")
        return text.strip()
    
    except Exception as e:
        if "429" in str(e):
            raise _RateLimitError(f"Zhipu 429: {e}")
        raise ValueError(f"Zhipu API error: {e}")

def _call_text_llm(
    client: Any,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.2,
) -> str:
    """
    Try primary OpenRouter model → fallback OpenRouter model → Gemini text.
    Each slot gets up to 2 attempts before moving on.
    Raises HTTPException(502) only when all three are exhausted.
    """
    _ = client

    primary_model  = os.getenv("OPENROUTER_PRIMARY_MODEL",  "meta-llama/llama-3.3-70b-instruct:free")
    fallback_model = os.getenv("OPENROUTER_FALLBACK_MODEL", "qwen/qwen3.6-plus-preview:free")

    providers = [
        (f"Llama (primary)",  lambda sp, up, t: _call_openrouter(primary_model,  sp, up, t)),
        (f"Qwen (fallback)",  lambda sp, up, t: _call_openrouter(fallback_model, sp, up, t)),
        ("Gemini (last resort)", _call_gemini_text),
    ]

    last_error = None

    for label, fn in providers:
        temp = temperature
        for attempt in range(1, 3):
            try:
                result = fn(system_prompt, user_prompt, temp)
                if label != "Llama (primary)":
                    print(f"[LLM] Used fallback: {label}")
                return result

            except _RateLimitError as exc:
                last_error = exc
                if attempt == 1:
                    print(f"[{label} attempt {attempt}] Rate limited — retrying in 8s...")
                    time.sleep(8)
                else:
                    print(f"[{label}] Rate limit on both attempts — switching provider.")
                continue

            except HTTPException:
                raise

            except Exception as exc:
                last_error = exc
                exc_str = str(exc).lower()
                retryable = any(k in exc_str for k in ["timeout", "connection", "504", "502", "empty", "429"])
                if attempt == 1 and retryable:
                    temp = min(temp + 0.1, 0.8)
                    print(f"[{label} attempt {attempt}] Retryable — waiting 4s: {exc}")
                    time.sleep(4)
                    continue
                print(f"[{label}] Switching provider: {exc}")
                break

    raise HTTPException(
        status_code=502,
        detail=f"All LLM providers exhausted. Last error: {last_error}",
    )