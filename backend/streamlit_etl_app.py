import base64
import io
import json
import os
import re
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import fitz
import pandas as pd
import streamlit as st
import zhipuai
from dotenv import load_dotenv
from supabase import Client, create_client


load_dotenv()


SUPPORTED_FILE_TYPES = ["csv", "pdf", "png", "jpg", "jpeg"]


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


def _extract_model_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: List[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                text_value = part.get("text") or part.get("content")
                if isinstance(text_value, str):
                    parts.append(text_value)
        return "\n".join(parts).strip()
    return str(content).strip()


def _strip_markdown_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    return cleaned


def normalize_report_month(value: str) -> Optional[str]:
    if not value:
        return None

    value = value.strip()
    regex_match = re.search(r"(20\d{2})[-_./ ]?(0?[1-9]|1[0-2])", value)
    if regex_match:
        year = int(regex_match.group(1))
        month = int(regex_match.group(2))
        return f"{year:04d}-{month:02d}"

    month_names = {
        "january": 1,
        "february": 2,
        "march": 3,
        "april": 4,
        "may": 5,
        "june": 6,
        "july": 7,
        "august": 8,
        "september": 9,
        "october": 10,
        "november": 11,
        "december": 12,
    }

    lowered = value.lower()
    for month_name, month_num in month_names.items():
        if month_name in lowered:
            year_match = re.search(r"(20\d{2})", lowered)
            if year_match:
                year = int(year_match.group(1))
                return f"{year:04d}-{month_num:02d}"

    return None


def extract_report_month_from_text(text: str) -> Optional[str]:
    return normalize_report_month(text)


def infer_category_from_item(item_name: str) -> str:
    lowered = (item_name or "").lower()
    if any(token in lowered for token in ["coffee", "latte", "espresso", "tea", "milo", "drink", "beverage"]):
        return "Coffee"
    if any(token in lowered for token in ["nasi", "mee", "rice", "chicken", "roti", "food", "burger", "sandwich"]):
        return "Food"
    return "Uncategorized"


def get_supabase_client() -> Client:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        raise RuntimeError(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY environment variables."
        )

    return create_client(supabase_url, supabase_key)


def get_zhipu_client() -> Any:
    api_key = os.getenv("ZHIPU_API_KEY") or os.getenv("ZHIPUAI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing ZHIPU_API_KEY or ZHIPUAI_API_KEY environment variable for Vision LLM parsing.")

    if not hasattr(zhipuai, "ZhipuAI"):
        raise RuntimeError("Installed zhipuai package does not expose ZhipuAI client.")

    return zhipuai.ZhipuAI(api_key=api_key)


def file_bytes_to_data_url(file_bytes: bytes, mime_type: str) -> str:
    encoded = base64.b64encode(file_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def call_vision_llm_json(vision_client: Any, data_url: str, prompt: str) -> Any:
    response = vision_client.chat.completions.create(
        model="glm-4.6v-flash",
        temperature=0,
        messages=[
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Read this document and return JSON only."},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
    )

    if not getattr(response, "choices", None):
        raise RuntimeError("Vision LLM returned no choices.")

    raw_content = response.choices[0].message.content
    text = _strip_markdown_fences(_extract_model_text(raw_content))

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Vision response is not valid JSON: {exc}") from exc


def render_pdf_to_png_data_urls(file_bytes: bytes, max_pages: int = 5) -> List[str]:
    data_urls: List[str] = []
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    page_limit = min(len(doc), max_pages)

    for page_index in range(page_limit):
        page = doc[page_index]
        pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
        image_bytes = pix.tobytes("png")
        data_urls.append(file_bytes_to_data_url(image_bytes, "image/png"))

    return data_urls


def process_sales_csv(uploaded_file: Any) -> Tuple[float, Dict[str, float], Optional[str]]:
    try:
        file_bytes = uploaded_file.getvalue()
        df = pd.read_csv(io.BytesIO(file_bytes))
    except Exception as exc:
        raise ValueError(f"Failed to read CSV {uploaded_file.name}: {exc}") from exc

    if df.empty:
        raise ValueError(f"CSV {uploaded_file.name} is empty.")

    normalized_cols = {str(col).strip().lower(): col for col in df.columns}

    def pick_col(candidates: List[str]) -> Optional[str]:
        for candidate in candidates:
            if candidate in normalized_cols:
                return normalized_cols[candidate]
        return None

    amount_col = pick_col(["total", "amount", "line_total", "sales_amount", "total_amount", "revenue"])
    qty_col = pick_col(["quantity", "qty", "units_sold"])
    unit_price_col = pick_col(["unit_price", "price", "selling_price"])
    category_col = pick_col(["category", "item_category", "product_category", "type"])
    item_col = pick_col(["item_name", "item", "product", "menu_item", "name"])
    date_col = pick_col(["date", "order_date", "log_date", "transaction_date"])

    if amount_col:
        revenue_series = pd.to_numeric(df[amount_col], errors="coerce")
    elif qty_col and unit_price_col:
        quantity = pd.to_numeric(df[qty_col], errors="coerce")
        unit_price = pd.to_numeric(df[unit_price_col], errors="coerce")
        revenue_series = quantity * unit_price
    else:
        raise ValueError(
            f"CSV {uploaded_file.name} is malformed. Include either amount/total column or quantity + unit_price columns."
        )

    valid_mask = revenue_series.notna()
    if valid_mask.sum() == 0:
        raise ValueError(f"CSV {uploaded_file.name} has no valid numeric sales rows.")

    df_valid = df.loc[valid_mask].copy()
    df_valid["_revenue"] = revenue_series.loc[valid_mask].astype(float)

    if category_col:
        df_valid["_category"] = df_valid[category_col].fillna("").astype(str).str.strip()
        if item_col:
            blank_mask = df_valid["_category"] == ""
            df_valid.loc[blank_mask, "_category"] = df_valid.loc[blank_mask, item_col].astype(str).map(infer_category_from_item)
        df_valid.loc[df_valid["_category"] == "", "_category"] = "Uncategorized"
    else:
        if item_col:
            df_valid["_category"] = df_valid[item_col].astype(str).map(infer_category_from_item)
        else:
            df_valid["_category"] = "Uncategorized"

    grouped = df_valid.groupby("_category", dropna=False)["_revenue"].sum()
    category_revenue = {k: round(float(v), 2) for k, v in grouped.to_dict().items()}
    total_revenue = round(float(df_valid["_revenue"].sum()), 2)

    inferred_month = None
    if date_col:
        parsed_dates = pd.to_datetime(df_valid[date_col], errors="coerce", dayfirst=True)
        parsed_dates = parsed_dates.dropna()
        if not parsed_dates.empty:
            month_counts = parsed_dates.dt.strftime("%Y-%m").value_counts()
            inferred_month = month_counts.index[0]

    return total_revenue, category_revenue, inferred_month


def parse_pl_from_image_data_url(vision_client: Any, data_url: str) -> List[Dict[str, Any]]:
    prompt = (
        "You are parsing a profit and loss statement image for a restaurant. "
        "Extract ONLY fixed operating costs and return JSON array with this schema: "
        "[{\"expense_type\":\"Rent|Payroll|Utilities|Other\",\"amount\":number}]. "
        "Ignore revenue lines and ingredient purchase lines. Return JSON only."
    )
    parsed = call_vision_llm_json(vision_client, data_url, prompt)
    if isinstance(parsed, dict):
        parsed = parsed.get("expenses", [])
    if not isinstance(parsed, list):
        raise ValueError("P&L parser expected a JSON array.")

    output: List[Dict[str, Any]] = []
    for row in parsed:
        if not isinstance(row, dict):
            continue
        expense_type = str(row.get("expense_type", "Other")).strip() or "Other"
        amount = round(_to_float(row.get("amount"), 0.0), 2)
        if amount > 0:
            output.append({"expense_type": expense_type, "amount": amount})

    return output


def parse_invoice_from_image_data_url(vision_client: Any, data_url: str) -> List[Dict[str, Any]]:
    prompt = (
        "You are parsing a supplier invoice for an F&B merchant. "
        "Extract ingredient-level lines and return JSON array with this schema: "
        "[{\"item_category\":\"Protein|Vegetable|Dry Goods|Dairy|Beverage|Other\","
        "\"item_name\":string,\"quantity\":number,\"unit\":string,\"unit_cost\":number,\"total_amount\":number}]. "
        "Return JSON only."
    )
    parsed = call_vision_llm_json(vision_client, data_url, prompt)
    if isinstance(parsed, dict):
        parsed = parsed.get("items", [])
    if not isinstance(parsed, list):
        raise ValueError("Invoice parser expected a JSON array.")

    output: List[Dict[str, Any]] = []
    for row in parsed:
        if not isinstance(row, dict):
            continue

        item_name = str(row.get("item_name", "")).strip()
        if not item_name:
            continue

        quantity = _to_float(row.get("quantity"), 0.0)
        unit = str(row.get("unit", "unit")).strip() or "unit"
        unit_cost = round(_to_float(row.get("unit_cost"), 0.0), 2)
        total_amount = round(_to_float(row.get("total_amount"), 0.0), 2)

        if total_amount <= 0 and quantity > 0 and unit_cost > 0:
            total_amount = round(quantity * unit_cost, 2)

        if total_amount <= 0:
            continue

        item_category = str(row.get("item_category", "Other")).strip() or "Other"
        output.append(
            {
                "item_category": item_category,
                "item_name": item_name,
                "quantity": quantity,
                "unit": unit,
                "unit_cost": unit_cost,
                "total_amount": total_amount,
            }
        )

    return output


def is_pl_document(filename: str) -> bool:
    lowered = filename.lower()
    return any(token in lowered for token in ["p&l", "profit", "loss", "overhead", "expense", "fixed_cost"])


def is_invoice_document(filename: str) -> bool:
    lowered = filename.lower()
    return any(token in lowered for token in ["invoice", "supplier", "purchase", "ingredients", "bill"])


def merge_category_revenue(target: Dict[str, float], incoming: Dict[str, float]) -> Dict[str, float]:
    merged = defaultdict(float)
    for category, amount in target.items():
        merged[category] += float(amount)
    for category, amount in incoming.items():
        merged[category] += float(amount)
    return {k: round(v, 2) for k, v in merged.items()}


def upsert_monthly_summary(supabase: Client, payload: Dict[str, Any]) -> str:
    upsert_error: Optional[Exception] = None

    try:
        response = (
            supabase.table("monthly_summaries")
            .upsert(payload, on_conflict="merchant_id,report_month")
            .execute()
        )
        if response.data and len(response.data) > 0 and response.data[0].get("id"):
            return str(response.data[0]["id"])
    except Exception as exc:
        upsert_error = exc

    existing = (
        supabase.table("monthly_summaries")
        .select("id")
        .eq("merchant_id", payload["merchant_id"])
        .eq("report_month", payload["report_month"])
        .limit(1)
        .execute()
    )

    if existing.data:
        summary_id = existing.data[0]["id"]
        supabase.table("monthly_summaries").update(payload).eq("id", summary_id).execute()
        return str(summary_id)

    inserted = supabase.table("monthly_summaries").insert(payload).execute()
    if inserted.data and inserted.data[0].get("id"):
        return str(inserted.data[0]["id"])

    if upsert_error:
        raise RuntimeError(f"Failed to upsert monthly_summaries: {upsert_error}")

    raise RuntimeError("Failed to write monthly_summaries record.")


def replace_operating_expenses(supabase: Client, summary_id: str, expenses: List[Dict[str, Any]]) -> int:
    supabase.table("operating_expenses").delete().eq("summary_id", summary_id).execute()

    if not expenses:
        return 0

    payload = [
        {
            "summary_id": summary_id,
            "expense_type": row["expense_type"],
            "amount": row["amount"],
        }
        for row in expenses
    ]

    inserted_count = 0
    batch_size = 200
    for i in range(0, len(payload), batch_size):
        batch = payload[i : i + batch_size]
        supabase.table("operating_expenses").insert(batch).execute()
        inserted_count += len(batch)

    return inserted_count


def replace_supplier_invoices(supabase: Client, summary_id: str, invoices: List[Dict[str, Any]]) -> int:
    supabase.table("supplier_invoices").delete().eq("summary_id", summary_id).execute()

    if not invoices:
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
        for row in invoices
    ]

    inserted_count = 0
    batch_size = 200
    for i in range(0, len(payload), batch_size):
        batch = payload[i : i + batch_size]
        supabase.table("supplier_invoices").insert(batch).execute()
        inserted_count += len(batch)

    return inserted_count


def parse_document_file(
    vision_client: Any,
    file_name: str,
    file_bytes: bytes,
    file_ext: str,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    pl_rows: List[Dict[str, Any]] = []
    invoice_rows: List[Dict[str, Any]] = []

    if file_ext in {"png", "jpg", "jpeg"}:
        mime = "image/png" if file_ext == "png" else "image/jpeg"
        data_url = file_bytes_to_data_url(file_bytes, mime)

        if is_pl_document(file_name):
            pl_rows.extend(parse_pl_from_image_data_url(vision_client, data_url))
        elif is_invoice_document(file_name):
            invoice_rows.extend(parse_invoice_from_image_data_url(vision_client, data_url))
        else:
            candidate_expenses = parse_pl_from_image_data_url(vision_client, data_url)
            if candidate_expenses:
                pl_rows.extend(candidate_expenses)
            else:
                invoice_rows.extend(parse_invoice_from_image_data_url(vision_client, data_url))

    elif file_ext == "pdf":
        data_urls = render_pdf_to_png_data_urls(file_bytes)
        if not data_urls:
            raise ValueError(f"No pages could be rendered from PDF {file_name}.")

        for data_url in data_urls:
            if is_pl_document(file_name):
                pl_rows.extend(parse_pl_from_image_data_url(vision_client, data_url))
            elif is_invoice_document(file_name):
                invoice_rows.extend(parse_invoice_from_image_data_url(vision_client, data_url))
            else:
                candidate_expenses = parse_pl_from_image_data_url(vision_client, data_url)
                if candidate_expenses:
                    pl_rows.extend(candidate_expenses)
                else:
                    invoice_rows.extend(parse_invoice_from_image_data_url(vision_client, data_url))

    return pl_rows, invoice_rows


def run_pipeline(merchant_id: str, report_month_input: str, uploaded_files: List[Any]) -> Dict[str, Any]:
    if not merchant_id.strip():
        raise ValueError("merchant_id is required.")

    if not uploaded_files:
        raise ValueError("Please upload at least one file.")

    supabase = get_supabase_client()

    total_revenue = 0.0
    category_revenue: Dict[str, float] = {}
    operating_expenses: List[Dict[str, Any]] = []
    supplier_invoices: List[Dict[str, Any]] = []

    detected_months: List[str] = []
    file_errors: List[str] = []

    vision_client: Optional[Any] = None

    for uploaded_file in uploaded_files:
        file_name = uploaded_file.name
        file_ext = file_name.split(".")[-1].lower()

        if file_ext not in SUPPORTED_FILE_TYPES:
            file_errors.append(f"Unsupported file type for {file_name}.")
            continue

        month_from_name = extract_report_month_from_text(file_name)
        if month_from_name:
            detected_months.append(month_from_name)

        try:
            if file_ext == "csv":
                csv_revenue, csv_category_revenue, month_from_data = process_sales_csv(uploaded_file)
                total_revenue += csv_revenue
                category_revenue = merge_category_revenue(category_revenue, csv_category_revenue)
                if month_from_data:
                    detected_months.append(month_from_data)
            else:
                if vision_client is None:
                    vision_client = get_zhipu_client()

                file_bytes = uploaded_file.getvalue()
                pl_rows, invoice_rows = parse_document_file(vision_client, file_name, file_bytes, file_ext)
                operating_expenses.extend(pl_rows)
                supplier_invoices.extend(invoice_rows)

        except Exception as exc:
            file_errors.append(f"{file_name}: {exc}")

    report_month = normalize_report_month(report_month_input)

    if not report_month:
        unique_months = sorted(set(detected_months))
        if len(unique_months) == 1:
            report_month = unique_months[0]
        elif len(unique_months) > 1:
            raise ValueError(
                f"Detected multiple report months {unique_months}. Enter report_month manually in YYYY-MM format."
            )
        else:
            raise ValueError("Unable to determine report_month from files. Enter report_month manually in YYYY-MM format.")

    total_fixed_costs = round(sum(row["amount"] for row in operating_expenses), 2)
    total_ingredient_costs = round(sum(row["total_amount"] for row in supplier_invoices), 2)
    net_profit = round(total_revenue - (total_fixed_costs + total_ingredient_costs), 2)

    summary_payload = {
        "merchant_id": merchant_id.strip(),
        "report_month": report_month,
        "total_revenue": round(total_revenue, 2),
        "total_fixed_costs": total_fixed_costs,
        "total_ingredient_costs": total_ingredient_costs,
        "net_profit": net_profit,
        "category_revenue": category_revenue,
    }

    summary_id = upsert_monthly_summary(supabase, summary_payload)

    inserted_expenses = replace_operating_expenses(supabase, summary_id, operating_expenses)
    inserted_invoices = replace_supplier_invoices(supabase, summary_id, supplier_invoices)

    supabase.table("monthly_summaries").update(
        {
            "total_revenue": round(total_revenue, 2),
            "total_fixed_costs": total_fixed_costs,
            "total_ingredient_costs": total_ingredient_costs,
            "net_profit": net_profit,
            "category_revenue": category_revenue,
        }
    ).eq("id", summary_id).execute()

    return {
        "summary_id": summary_id,
        "merchant_id": merchant_id,
        "report_month": report_month,
        "total_revenue": round(total_revenue, 2),
        "total_fixed_costs": total_fixed_costs,
        "total_ingredient_costs": total_ingredient_costs,
        "net_profit": net_profit,
        "category_revenue": category_revenue,
        "operating_expenses_count": inserted_expenses,
        "supplier_invoices_count": inserted_invoices,
        "file_errors": file_errors,
        "processed_at": datetime.utcnow().isoformat() + "Z",
    }


def main() -> None:
    st.set_page_config(page_title="Tauke.ai ETL Uploader", layout="wide")
    st.title("Tauke.ai Monthly ETL Processor")
    st.caption("Upload CSV, PDF, PNG, JPG files and load monthly results into Supabase.")

    merchant_id = st.text_input("merchant_id", placeholder="e.g. c6417c1f-56ee-4f6a-bab8-def781d9418f")
    report_month_input = st.text_input("report_month (optional)", placeholder="YYYY-MM")

    uploaded_files = st.file_uploader(
        "Upload sales CSV, P&L images/PDFs, and supplier invoice images/PDFs",
        type=SUPPORTED_FILE_TYPES,
        accept_multiple_files=True,
    )

    if uploaded_files:
        st.write(f"Files selected: {len(uploaded_files)}")
        st.write([f.name for f in uploaded_files])

    if st.button("Process All", type="primary"):
        try:
            result = run_pipeline(merchant_id, report_month_input, uploaded_files or [])
            st.success("Pipeline completed successfully.")
            st.json(result)

            if result["file_errors"]:
                st.warning("Some files could not be fully processed.")
                for err in result["file_errors"]:
                    st.write(f"- {err}")

        except Exception as exc:
            st.error(f"Processing failed: {exc}")


if __name__ == "__main__":
    main()
