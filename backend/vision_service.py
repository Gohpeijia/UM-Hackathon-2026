import json
import os
from typing import Any, Dict, List

from dotenv import load_dotenv, find_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, HttpUrl
from supabase import Client, create_client

import zhipuai


load_dotenv(find_dotenv())


SYSTEM_PROMPT = """You are an F&B AI with two distinct tasks. 
TASK 1 (Extraction): Read the image and extract the exact 'item_name' and 'original_price'. 
TASK 2 (Inference): The rest of the data is not on the menu. Act as a Master Chef and infer the following for each item based on your knowledge: 1. 'estimated_cogs' (RM, 15-60% margin depending on item type), 2. 'ingredients_list' (core ingredients, comma-separated text), 3. 'required_hardware' (a single primary cooking station, e.g., 'Wok', 'Drink Station', 'Steamer', 'Deep Fryer'), 4. 'prep_time_seconds' (integer, 30s-300s). 
Return strictly a JSON array of these combined objects, with no markdown formatting."""


class AnalyzeMenuRequest(BaseModel):
    image_url: HttpUrl


class SaveOnboardingRequest(BaseModel):
    merchant_id: str = Field(min_length=1)
    approved_items: List[Dict[str, Any]]
    hardware_inventory: Dict[str, int]
    staff_count: int = Field(ge=0)


app = FastAPI(title="Vision Onboarding Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_zhipu_api_key() -> str:
    api_key = os.getenv("ZHIPU_API_KEY") or os.getenv("ZHIPUAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Missing ZHIPU_API_KEY or ZHIPUAI_API_KEY environment variable",
        )
    return api_key


def analyze_with_zhipu(image_url: str) -> str:
    api_key = get_zhipu_api_key()
    model_candidates = [
        "glm-4.6v-flash",
    ]
    model_errors: List[str] = []

    # Newer SDK style
    if hasattr(zhipuai, "ZhipuAI"):
        client = zhipuai.ZhipuAI(api_key=api_key)
        for model_name in model_candidates:
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    temperature=0,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "Analyze this menu image and return the JSON array only."},
                                {"type": "image_url", "image_url": {"url": image_url}},
                            ],
                        },
                    ],
                )

                if not getattr(response, "choices", None):
                    raise HTTPException(status_code=502, detail="No response choices from vision model")

                message = response.choices[0].message
                raw_content = getattr(message, "content", "")
                return _extract_model_text(raw_content)
            except Exception as exc:
                model_errors.append(f"{model_name}: {str(exc)}")

        raise HTTPException(
            status_code=502,
            detail=f"All candidate Zhipu models failed: {' | '.join(model_errors)}",
        )

    # Legacy SDK style
    if not hasattr(zhipuai, "model_api"):
        raise HTTPException(
            status_code=500,
            detail="No compatible Zhipu client API found in installed SDK",
        )

    zhipuai.api_key = api_key
    for model_name in model_candidates:
        try:
            legacy_response = zhipuai.model_api.invoke(
                model=model_name,
                prompt=[
                    {
                        "role": "system",
                        "content": SYSTEM_PROMPT,
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Analyze this menu image and return the JSON array only."},
                            {"type": "image_url", "image_url": {"url": image_url}},
                        ],
                    },
                ],
            )

            data = legacy_response.get("data") if isinstance(legacy_response, dict) else None
            if not isinstance(data, dict):
                raise HTTPException(status_code=502, detail=f"Unexpected legacy SDK response: {legacy_response}")

            choices = data.get("choices")
            if not isinstance(choices, list) or not choices:
                raise HTTPException(status_code=502, detail=f"No choices in legacy SDK response: {legacy_response}")

            first_choice = choices[0] if isinstance(choices[0], dict) else {}
            content = first_choice.get("content")
            return _extract_model_text(content)
        except Exception as exc:
            model_errors.append(f"{model_name}: {str(exc)}")

    raise HTTPException(
        status_code=502,
        detail=f"All candidate Zhipu models failed: {' | '.join(model_errors)}",
    )


def get_supabase_client() -> Client:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        raise HTTPException(
            status_code=500,
            detail="Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY environment variables",
        )

    return create_client(supabase_url, supabase_key)


def _extract_model_text(raw_content: Any) -> str:
    if isinstance(raw_content, str):
        return raw_content.strip()

    if isinstance(raw_content, list):
        text_parts: List[str] = []
        for part in raw_content:
            if isinstance(part, dict):
                if isinstance(part.get("text"), str):
                    text_parts.append(part["text"])
                elif isinstance(part.get("content"), str):
                    text_parts.append(part["content"])
            elif isinstance(part, str):
                text_parts.append(part)
        return "\n".join(text_parts).strip()

    return str(raw_content).strip()


def _contains_cjk(text: str) -> bool:
    return any("\u4e00" <= ch <= "\u9fff" for ch in text)


def _repair_mojibake_text(text: str) -> str:
    if not text:
        return text

    # Heuristic markers for UTF-8 text that was decoded as Latin-1/CP1252.
    mojibake_markers = ("Ã", "Â", "æ", "å", "ç", "è", "é", "ê", "ë", "ì", "í", "î", "ï")
    if not any(m in text for m in mojibake_markers):
        return text

    try:
        repaired = text.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text

    # Accept repaired output when it appears meaningfully better.
    if _contains_cjk(repaired):
        return repaired

    original_marker_count = sum(text.count(m) for m in mojibake_markers)
    repaired_marker_count = sum(repaired.count(m) for m in mojibake_markers)
    if repaired_marker_count < original_marker_count:
        return repaired

    return text


def _strip_markdown_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    return cleaned


def _looks_like_mojibake(text: str) -> bool:
    if not text or _contains_cjk(text):
        return False

    mojibake_markers = ("Ã", "Â", "æ", "å", "ç", "è", "é", "ê", "ë", "ì", "í", "î", "ï")
    marker_hits = sum(text.count(m) for m in mojibake_markers)
    return marker_hits >= 2


def _repair_suspected_texts_with_glm47_flash(candidates: List[str]) -> Dict[int, str]:
    if not candidates:
        return {}

    if not hasattr(zhipuai, "ZhipuAI"):
        return {}

    try:
        client = zhipuai.ZhipuAI(api_key=get_zhipu_api_key())
        request_payload = [{"index": i, "text": text} for i, text in enumerate(candidates)]

        repair_prompt = (
            "You repair mojibake/corrupted Chinese text. "
            "For each input index, return the best corrected text and confidence score. "
            "Return strictly a JSON array of objects with keys: index (int), repaired_text (string), confidence (0-1). "
            "Do not include markdown or extra commentary."
        )

        response = client.chat.completions.create(
            model="glm-4.7-flash",
            temperature=0,
            messages=[
                {"role": "system", "content": repair_prompt},
                {
                    "role": "user",
                    "content": "Repair these strings: " + json.dumps(request_payload, ensure_ascii=False),
                },
            ],
        )

        if not getattr(response, "choices", None):
            return {}

        raw_content = getattr(response.choices[0].message, "content", "")
        content_text = _extract_model_text(raw_content)
        cleaned = _strip_markdown_fences(content_text)
        parsed = json.loads(cleaned)

        if not isinstance(parsed, list):
            return {}

        repaired_map: Dict[int, str] = {}
        for row in parsed:
            if not isinstance(row, dict):
                continue

            idx = row.get("index")
            repaired_text = row.get("repaired_text")
            confidence = row.get("confidence", 0)

            try:
                idx_int = int(idx)
                confidence_value = float(confidence)
            except (TypeError, ValueError):
                continue

            if idx_int < 0 or idx_int >= len(candidates):
                continue

            if isinstance(repaired_text, str) and repaired_text.strip() and confidence_value >= 0.75:
                repaired_map[idx_int] = repaired_text.strip()

        return repaired_map
    except Exception:
        # Repair fallback must never break the main onboarding pipeline.
        return {}


def _to_float(value: Any, fallback: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        cleaned = "".join(ch for ch in value if ch.isdigit() or ch in {".", "-"})
        try:
            return float(cleaned)
        except (TypeError, ValueError):
            return fallback

    return fallback


def _to_int(value: Any, fallback: int = 60) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return fallback


def _normalize_menu_item_for_insert(item: Dict[str, Any], merchant_id: str) -> Dict[str, Any]:
    # Align strictly with current menu_items table shape shown in Supabase.
    return {
        "merchant_id": merchant_id,
        "item_name": _repair_mojibake_text(str(item.get("item_name", ""))).strip(),
        "original_price": _to_float(item.get("original_price"), 0.0),
        "estimated_cogs": _to_float(item.get("estimated_cogs"), 0.0),
        "ingredients_list": _repair_mojibake_text(str(item.get("ingredients_list", ""))).strip(),
        "required_hardware": _repair_mojibake_text(str(item.get("required_hardware", ""))).strip(),
        "prep_time_seconds": _to_int(item.get("prep_time_seconds"), 60),
        "is_active": True,
    }


def _parse_json_array(model_output_text: str) -> List[Dict[str, Any]]:
    cleaned = _strip_markdown_fences(model_output_text)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Vision model did not return valid JSON array: {str(exc)}",
        ) from exc

    if not isinstance(parsed, list):
        raise HTTPException(status_code=502, detail="Vision model response must be a JSON array")

    normalized: List[Dict[str, Any]] = []
    for idx, item in enumerate(parsed):
        if not isinstance(item, dict):
            raise HTTPException(
                status_code=502,
                detail=f"Invalid item at index {idx}: each item must be a JSON object",
            )

        normalized.append(
            {
                "item_name": _repair_mojibake_text(str(item.get("item_name", ""))),
                "original_price": _to_float(item.get("original_price"), 0.0),
                "estimated_cogs": _to_float(item.get("estimated_cogs"), 0.0),
                "ingredients_list": _repair_mojibake_text(str(item.get("ingredients_list", ""))),
                "required_hardware": _repair_mojibake_text(str(item.get("required_hardware", ""))),
                "prep_time_seconds": _to_int(item.get("prep_time_seconds"), 60),
            }
        )

    # Second-pass repair via text model for strings that still look corrupted.
    repair_targets: List[Dict[str, Any]] = []
    repair_texts: List[str] = []
    for item_idx, row in enumerate(normalized):
        for field_name in ("item_name", "ingredients_list"):
            value = row.get(field_name)
            if isinstance(value, str) and _looks_like_mojibake(value):
                repair_targets.append({"item_idx": item_idx, "field_name": field_name})
                repair_texts.append(value)

    if repair_texts:
        repaired_map = _repair_suspected_texts_with_glm47_flash(repair_texts)
        for candidate_idx, repaired_text in repaired_map.items():
            target = repair_targets[candidate_idx]
            normalized[target["item_idx"]][target["field_name"]] = repaired_text

    return normalized


@app.get("/health")
def healthcheck() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze-menu")
def analyze_menu(payload: AnalyzeMenuRequest) -> Dict[str, Any]:
    try:
        content_text = analyze_with_zhipu(str(payload.image_url))

        if not content_text:
            raise HTTPException(status_code=502, detail="Empty response content from vision model")

        items = _parse_json_array(content_text)

        return {"items": items}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to analyze menu image: {str(exc)}") from exc


@app.post("/save-onboarding")
def save_onboarding(payload: SaveOnboardingRequest) -> Dict[str, Any]:
    try:
        supabase = get_supabase_client()

        rows_to_insert: List[Dict[str, Any]] = []
        for item in payload.approved_items:
            rows_to_insert.append(_normalize_menu_item_for_insert(dict(item), payload.merchant_id))

        inserted_count = 0
        if rows_to_insert:
            insert_result = supabase.table("menu_items").insert(rows_to_insert).execute()
            inserted_data = getattr(insert_result, "data", None) or []
            inserted_count = len(inserted_data)

        update_result = (
            supabase.table("merchants")
            .update(
                {
                    "hardware_inventory": payload.hardware_inventory,
                    "staff_count": payload.staff_count,
                }
            )
            .eq("id", payload.merchant_id)
            .execute()
        )

        updated_data = getattr(update_result, "data", None) or []
        if not updated_data:
            raise HTTPException(
                status_code=404,
                detail=f"Merchant not found for id={payload.merchant_id}",
            )

        return {
            "success": True,
            "message": "Onboarding data saved successfully",
            "inserted_menu_items": inserted_count,
            "updated_merchant_id": payload.merchant_id,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save onboarding data: {str(exc)}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("vision_service:app", host="0.0.0.0", port=8001, reload=True)
