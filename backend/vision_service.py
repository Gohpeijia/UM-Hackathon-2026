import base64
import io
import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

import fitz
import pandas as pd
import zhipuai
from dotenv import find_dotenv, load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import Client, create_client


load_dotenv(find_dotenv())


MASTER_EXTRACT_PROMPT = (
    "You are an F&B Financial Auditor for a Malaysian Cafe. Analyze this document and extract all financial data into a strict JSON format. "
    "1. If you see fixed costs (e.g., Rent, Payroll, TNB, Syabas, KWSP, Utilities), put them in 'operating_expenses'. "
    "2. If you see ingredient purchases (e.g., Chicken, Beans, Milk, Ice), put them in 'supplier_invoices'. "
    "\\n\\nRETURN ONLY JSON IN THIS EXACT FORMAT: "
    "{"
    "  \"document_type\": \"pl_statement\" | \"supplier_invoice\" | \"mixed\","
    "  \"operating_expenses\": ["
    "    {\"expense_type\": \"Rent|Payroll|Utilities|Other\", \"amount\": 0.00}"
    "  ],"
    "  \"supplier_invoices\": ["
    "    {\"item_category\": \"Protein|Vegetable|Dry Goods|Dairy|Beverage|Other\", "
    "     \"item_name\": \"string\", \"quantity\": 0.0, \"unit\": \"string\", \"total_amount\": 0.00}"
    "  ]"
    "}"
)


class AnalyzeFinancialDocumentRequest(BaseModel):
    file_name: str = Field(min_length=1)
    file_data_url: str = Field(min_length=1)


class ProcessMonthlyUploadRequest(BaseModel):
    merchant_id: str = Field(min_length=1)
    merchant_profile: str = Field(min_length=1)
    report_month: str = Field(min_length=7)
    scanned_documents: List[Dict[str, Any]] = Field(default_factory=list)
    sales_csv_data_url: str = Field(min_length=1)


app = FastAPI(title="Vision Financial Upload Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Specifically allow your React frontend
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


def get_zhipu_client() -> Any:
    api_key = get_zhipu_api_key()
    if hasattr(zhipuai, "ZhipuAI"):
        return {"mode": "modern", "client": zhipuai.ZhipuAI(api_key=api_key)}

    if hasattr(zhipuai, "model_api"):
        zhipuai.api_key = api_key
        return {"mode": "legacy", "client": zhipuai}

    raise HTTPException(
        status_code=500,
        detail="Installed zhipuai package has neither ZhipuAI nor model_api interface",
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
        parts: List[str] = []
        for part in raw_content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                text_value = part.get("text") or part.get("content")
                if isinstance(text_value, str):
                    parts.append(text_value)
        return "\n".join(parts).strip()

    return str(raw_content).strip()


def _strip_markdown_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    return cleaned


def _to_float(value: Any, default: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = "".join(ch for ch in value if ch.isdigit() or ch in {".", "-"})
        try:
            return float(cleaned)
        except ValueError:
            return default
    return default


def _decode_data_url(data_url: str) -> Tuple[str, bytes]:
    if not data_url.startswith("data:") or "," not in data_url:
        raise HTTPException(status_code=400, detail="file_data_url must be a valid data URL")

    header, encoded = data_url.split(",", 1)
    mime = header[5:].split(";")[0].lower()

    if ";base64" not in header:
        raise HTTPException(status_code=400, detail="Only base64 data URLs are supported")

    try:
        raw = base64.b64decode(encoded)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 payload: {exc}") from exc

    return mime, raw


def _bytes_to_data_url(file_bytes: bytes, mime_type: str) -> str:
    encoded = base64.b64encode(file_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def _render_pdf_pages_as_data_urls(file_bytes: bytes, max_pages: int = 5) -> List[str]:
    data_urls: List[str] = []
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    page_limit = min(len(doc), max_pages)

    for page_index in range(page_limit):
        page = doc[page_index]
        pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
        png_bytes = pix.tobytes("png")
        data_urls.append(_bytes_to_data_url(png_bytes, "image/png"))

    return data_urls


def _vision_json(client: Any, image_data_url: str, prompt: str) -> Any:
    mode = client.get("mode")
    sdk_client = client.get("client")

    if mode == "modern":
        response = sdk_client.chat.completions.create(
            model="glm-4.6v-flash",
            temperature=0,
            messages=[
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Read this document and return JSON only."},
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                    ],
                },
            ],
        )

        if not getattr(response, "choices", None):
            raise HTTPException(status_code=502, detail="Vision model returned no choices")

        raw_text = _extract_model_text(response.choices[0].message.content)
    elif mode == "legacy":
        legacy_response = sdk_client.model_api.invoke(
            model="glm-4.6v-flash",
            prompt=[
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Read this document and return JSON only."},
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                    ],
                },
            ],
        )

        data = legacy_response.get("data") if isinstance(legacy_response, dict) else None
        choices = data.get("choices") if isinstance(data, dict) else None
        if not isinstance(choices, list) or not choices:
            raise HTTPException(status_code=502, detail=f"Legacy vision response invalid: {legacy_response}")

        first_choice = choices[0] if isinstance(choices[0], dict) else {}
        raw_text = _extract_model_text(first_choice.get("content", ""))
    else:
        raise HTTPException(status_code=500, detail="Unsupported zhipu client mode")

    cleaned = _strip_markdown_fences(raw_text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"Vision model returned invalid JSON: {exc}") from exc


def _normalize_pl_rows(parsed: Any) -> List[Dict[str, Any]]:
    if isinstance(parsed, list):
        rows = parsed
    elif isinstance(parsed, dict):
        rows = parsed.get("operating_expenses") or []
    else:
        rows = []

    if not isinstance(rows, list):
        rows = []

    normalized: List[Dict[str, Any]] = []

    for row in rows:
        if not isinstance(row, dict):
            continue
        if "expense_type" not in row or "amount" not in row:
            continue
        expense_type = str(row.get("expense_type", "Other")).strip() or "Other"
        amount = round(_to_float(row.get("amount"), 0.0), 2)
        if amount > 0:
            normalized.append({"expense_type": expense_type, "amount": amount})

    return normalized


def _normalize_invoice_rows(parsed: Any) -> List[Dict[str, Any]]:
    if isinstance(parsed, list):
        rows = parsed
    elif isinstance(parsed, dict):
        rows = parsed.get("supplier_invoices") or []
    else:
        rows = []

    if not isinstance(rows, list):
        rows = []

    normalized: List[Dict[str, Any]] = []

    for row in rows:
        if not isinstance(row, dict):
            continue
        
        # ONLY require item_name and total_amount. 
        # If the AI forgets these, it's useless data.
        if "item_name" not in row or "total_amount" not in row:
            continue

        item_name = str(row.get("item_name", "")).strip()
        if not item_name:
            continue

        # Provide safe defaults if the AI missed these optional keys
        quantity = _to_float(row.get("quantity", 1.0), 1.0) # Default to 1
        unit = str(row.get("unit", "unit")).strip() or "unit"
        total_amount = round(_to_float(row.get("total_amount"), 0.0), 2)

        if total_amount <= 0:
            continue

        item_category = str(row.get("item_category", "Other")).strip() or "Other"
        unit_cost = round((total_amount / quantity), 4) if quantity > 0 else total_amount

        normalized.append(
            {
                "item_category": item_category,
                "item_name": item_name,
                "quantity": quantity,
                "unit": unit,
                "unit_cost": unit_cost,
                "total_amount": total_amount,
            }
        )

    return normalized


def _coerce_master_payload(parsed: Any) -> Dict[str, Any]:
    # Expected shape:
    # {
    #   "document_type": "pl_statement|supplier_invoice|mixed",
    #   "operating_expenses": [...],
    #   "supplier_invoices": [...]
    # }
    if isinstance(parsed, dict):
        # Handle alternative wrappers that models often emit.
        if "operating_expenses" in parsed or "supplier_invoices" in parsed:
            return {
                "document_type": str(parsed.get("document_type", "unknown")).strip().lower(),
                "operating_expenses": parsed.get("operating_expenses") or parsed.get("expenses") or [],
                "supplier_invoices": parsed.get("supplier_invoices") or parsed.get("invoices") or parsed.get("items") or [],
            }

        # If dict is a single row-like structure, wrap it into one of the arrays.
        if "expense_type" in parsed and "amount" in parsed:
            return {
                "document_type": "pl_statement",
                "operating_expenses": [parsed],
                "supplier_invoices": [],
            }
        if "item_name" in parsed and "total_amount" in parsed:
            return {
                "document_type": "supplier_invoice",
                "operating_expenses": [],
                "supplier_invoices": [parsed],
            }

        return {
            "document_type": str(parsed.get("document_type", "unknown")).strip().lower(),
            "operating_expenses": [],
            "supplier_invoices": [],
        }

    if isinstance(parsed, list):
        operating_expenses: List[Dict[str, Any]] = []
        supplier_invoices: List[Dict[str, Any]] = []

        for row in parsed:
            if not isinstance(row, dict):
                continue
            if "expense_type" in row and "amount" in row:
                operating_expenses.append(row)
            elif "item_name" in row and "total_amount" in row:
                supplier_invoices.append(row)

        if operating_expenses and supplier_invoices:
            doc_type = "mixed"
        elif operating_expenses:
            doc_type = "pl_statement"
        elif supplier_invoices:
            doc_type = "supplier_invoice"
        else:
            doc_type = "unknown"

        return {
            "document_type": doc_type,
            "operating_expenses": operating_expenses,
            "supplier_invoices": supplier_invoices,
        }

    return {
        "document_type": "unknown",
        "operating_expenses": [],
        "supplier_invoices": [],
    }


def _parse_sales_logs_csv(csv_bytes: bytes) -> pd.DataFrame:
    try:
        df = pd.read_csv(io.BytesIO(csv_bytes))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read sales CSV: {exc}") from exc

    if df.empty:
        raise HTTPException(status_code=400, detail="Sales CSV is empty")

    normalized_cols = {str(c).strip().lower(): c for c in df.columns}
    required = ["order_id", "timestamp", "item_name", "quantity", "price"]
    missing = [col for col in required if col not in normalized_cols]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Sales CSV missing required columns: {', '.join(missing)}",
        )

    selected = pd.DataFrame(
        {
            "order_id": df[normalized_cols["order_id"]],
            "timestamp": df[normalized_cols["timestamp"]],
            "item_name": df[normalized_cols["item_name"]],
            "quantity": df[normalized_cols["quantity"]],
            "price": df[normalized_cols["price"]],
        }
    )

    selected["logged_at"] = pd.to_datetime(selected["timestamp"], errors="coerce", utc=True)
    selected["order_id"] = selected["order_id"].astype(str).str.strip()
    selected["item_name"] = selected["item_name"].astype(str).str.strip()
    selected["quantity"] = pd.to_numeric(selected["quantity"], errors="coerce")
    selected["price"] = pd.to_numeric(selected["price"], errors="coerce")

    selected = selected.dropna(subset=["logged_at", "quantity", "price"])
    selected = selected[selected["item_name"] != ""]
    selected["quantity"] = selected["quantity"].astype(int)
    selected = selected[selected["quantity"] > 0]
    selected = selected[selected["price"] >= 0]

    if selected.empty:
        raise HTTPException(status_code=400, detail="Sales CSV has no valid rows after cleaning")

    return selected[["order_id", "item_name", "quantity", "price", "logged_at"]]


def _month_window(report_month: str) -> Tuple[str, str]:
    year = int(report_month[:4])
    month = int(report_month[5:7])

    start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month + 1, 1, tzinfo=timezone.utc)

    return start.isoformat(), end.isoformat()


def _ingest_sales_logs(
    supabase: Client,
    merchant_id: str,
    report_month: str,
    sales_df: pd.DataFrame,
    batch_size: int = 1000,
) -> Tuple[int, float, Dict[str, float]]:
    start_iso, end_iso = _month_window(report_month)
    start_ts = pd.Timestamp(start_iso)
    end_ts = pd.Timestamp(end_iso)

    # Idempotency strategy: clear this merchant's month window before re-insert.
    supabase.table("sales_logs").delete().eq("merchant_id", merchant_id).gte("logged_at", start_iso).lt("logged_at", end_iso).execute()

    month_df = sales_df[(sales_df["logged_at"] >= start_ts) & (sales_df["logged_at"] < end_ts)].copy()
    if month_df.empty:
        raise HTTPException(status_code=400, detail="Sales CSV has no rows matching report_month window")

    month_df["merchant_id"] = merchant_id
    month_df["logged_at"] = month_df["logged_at"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    month_df["quantity"] = month_df["quantity"].astype(int)
    month_df["price"] = month_df["price"].astype(float)

    # Avoid duplicate rows inside the uploaded file itself.
    month_df = month_df.drop_duplicates(subset=["order_id", "item_name", "logged_at", "quantity", "price"])

    records = month_df[["merchant_id", "order_id", "item_name", "quantity", "price", "logged_at"]].to_dict(orient="records")

    inserted_count = 0
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        supabase.table("sales_logs").insert(batch).execute()
        inserted_count += len(batch)

    month_df["line_revenue"] = month_df["quantity"] * month_df["price"]
    total_revenue = round(float(month_df["line_revenue"].sum()), 2)
    grouped = month_df.groupby("item_name", dropna=False)["line_revenue"].sum()
    category_revenue = {str(k): round(float(v), 2) for k, v in grouped.to_dict().items()}

    return inserted_count, total_revenue, category_revenue


def _normalize_report_month(report_month: str) -> str:
    value = report_month.strip()
    if not re.fullmatch(r"\d{4}-\d{2}", value):
        raise HTTPException(status_code=400, detail="report_month must be YYYY-MM")

    year = int(value[:4])
    month = int(value[5:7])
    if year < 2000 or month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="report_month must be a valid month in YYYY-MM")

    return f"{year:04d}-{month:02d}"


def _upsert_monthly_summary(supabase: Client, payload: Dict[str, Any]) -> str:
    try:
        response = (
            supabase.table("monthly_summaries")
            .upsert(payload, on_conflict="merchant_id,report_month")
            .execute()
        )
        if response.data and response.data[0].get("id"):
            return str(response.data[0]["id"])
    except Exception:
        pass

    existing = (
        supabase.table("monthly_summaries")
        .select("id")
        .eq("merchant_id", payload["merchant_id"])
        .eq("report_month", payload["report_month"])
        .limit(1)
        .execute()
    )

    if existing.data:
        summary_id = str(existing.data[0]["id"])
        supabase.table("monthly_summaries").update(payload).eq("id", summary_id).execute()
        return summary_id

    inserted = supabase.table("monthly_summaries").insert(payload).execute()
    if inserted.data and inserted.data[0].get("id"):
        return str(inserted.data[0]["id"])

    raise HTTPException(status_code=500, detail="Failed to upsert monthly summary")


def _replace_operating_expenses(supabase: Client, summary_id: str, rows: List[Dict[str, Any]]) -> int:
    supabase.table("operating_expenses").delete().eq("summary_id", summary_id).execute()

    if not rows:
        return 0

    payload = [
        {
            "summary_id": summary_id,
            "expense_type": row["expense_type"],
            "amount": row["amount"],
        }
        for row in rows
    ]

    supabase.table("operating_expenses").insert(payload).execute()
    return len(payload)


def _replace_supplier_invoices(supabase: Client, summary_id: str, rows: List[Dict[str, Any]]) -> int:
    supabase.table("supplier_invoices").delete().eq("summary_id", summary_id).execute()

    if not rows:
        return 0

    payload = [
        {
            "summary_id": summary_id,
            "item_category": row["item_category"],
            "item_name": row["item_name"],
            "quantity": row["quantity"],
            "unit": row["unit"],
            "unit_cost": row["unit_cost"],
            "total_amount": row["total_amount"],
        }
        for row in rows
    ]

    supabase.table("supplier_invoices").insert(payload).execute()
    return len(payload)


@app.get("/health")
def healthcheck() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze-financial-document")
def analyze_financial_document(payload: AnalyzeFinancialDocumentRequest) -> Dict[str, Any]:
    mime, raw_bytes = _decode_data_url(payload.file_data_url)

    if mime in {"image/png", "image/jpeg", "image/jpg"}:
        pages = [payload.file_data_url]
    elif mime == "application/pdf":
        pages = _render_pdf_pages_as_data_urls(raw_bytes)
        if not pages:
            raise HTTPException(status_code=400, detail="PDF has no renderable pages")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file mime type: {mime}")

    client = get_zhipu_client()

    operating_expenses: List[Dict[str, Any]] = []
    supplier_invoices: List[Dict[str, Any]] = []
    extraction_errors: List[str] = []
    detected_types: set[str] = set()

    for page_index, page_data_url in enumerate(pages, start=1):
        # Single-pass extraction per page with a strict master schema.
        try:
            parsed = _vision_json(client, page_data_url, MASTER_EXTRACT_PROMPT)
            parsed_obj = _coerce_master_payload(parsed)

            page_type = str(parsed_obj.get("document_type", "")).strip().lower()
            if page_type in {"pl_statement", "supplier_invoice", "mixed"}:
                detected_types.add(page_type)

            operating_expenses.extend(_normalize_pl_rows(parsed_obj.get("operating_expenses", [])))
            supplier_invoices.extend(_normalize_invoice_rows(parsed_obj.get("supplier_invoices", [])))
        except HTTPException as exc:
            extraction_errors.append(f"page {page_index} extract: {exc.detail}")

    if not operating_expenses and not supplier_invoices:
        reason = "; ".join(extraction_errors[:4]) if extraction_errors else "Vision output did not match expected schemas"
        raise HTTPException(
            status_code=422,
            detail=f"No extractable financial rows found from vision scan. Reason: {reason}",
        )

    if "mixed" in detected_types or (operating_expenses and supplier_invoices):
        document_type = "mixed"
    elif "pl_statement" in detected_types or operating_expenses:
        document_type = "pl_statement"
    elif "supplier_invoice" in detected_types or supplier_invoices:
        document_type = "supplier_invoice"
    else:
        document_type = "unknown"

    return {
        "file_name": payload.file_name,
        "document_type": document_type,
        "operating_expenses": operating_expenses,
        "supplier_invoices": supplier_invoices,
    }


@app.post("/process-monthly-upload")
def process_monthly_upload(payload: ProcessMonthlyUploadRequest) -> Dict[str, Any]:
    report_month = _normalize_report_month(payload.report_month)

    csv_mime, csv_bytes = _decode_data_url(payload.sales_csv_data_url)
    if csv_mime not in {"text/csv", "application/vnd.ms-excel", "application/octet-stream"}:
        raise HTTPException(status_code=400, detail=f"Unsupported sales CSV mime type: {csv_mime}")

    sales_df = _parse_sales_logs_csv(csv_bytes)

    operating_expenses: List[Dict[str, Any]] = []
    supplier_invoices: List[Dict[str, Any]] = []

    for doc in payload.scanned_documents:
        if not isinstance(doc, dict):
            continue
        operating_expenses.extend(_normalize_pl_rows(doc.get("operating_expenses", [])))
        supplier_invoices.extend(_normalize_invoice_rows(doc.get("supplier_invoices", [])))

    supabase = get_supabase_client()
    inserted_sales_logs, total_revenue, category_revenue = _ingest_sales_logs(
        supabase=supabase,
        merchant_id=payload.merchant_id.strip(),
        report_month=report_month,
        sales_df=sales_df,
        batch_size=1000,
    )

    total_fixed_costs = round(sum(row["amount"] for row in operating_expenses), 2)
    total_ingredient_costs = round(sum(row["total_amount"] for row in supplier_invoices), 2)
    net_profit = round(total_revenue - (total_fixed_costs + total_ingredient_costs), 2)

    summary_payload = {
        "merchant_id": payload.merchant_id.strip(),
        "report_month": report_month,
        "total_revenue": total_revenue,
        "total_fixed_costs": total_fixed_costs,
        "total_ingredient_costs": total_ingredient_costs,
        "net_profit": net_profit,
        "category_revenue": category_revenue,
    }

    summary_id = _upsert_monthly_summary(supabase, summary_payload)

    inserted_expenses = _replace_operating_expenses(supabase, summary_id, operating_expenses)
    inserted_invoices = _replace_supplier_invoices(supabase, summary_id, supplier_invoices)

    supabase.table("monthly_summaries").update(summary_payload).eq("id", summary_id).execute()

    return {
        "summary_id": summary_id,
        "merchant_id": payload.merchant_id,
        "report_month": report_month,
        "merchant_profile": payload.merchant_profile.strip(),
        "total_revenue": total_revenue,
        "total_fixed_costs": total_fixed_costs,
        "total_ingredient_costs": total_ingredient_costs,
        "net_profit": net_profit,
        "category_revenue": category_revenue,
        "sales_logs_rows": inserted_sales_logs,
        "operating_expenses_rows": inserted_expenses,
        "supplier_invoices_rows": inserted_invoices,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("vision_service:app", host="0.0.0.0", port=8001, reload=True)
