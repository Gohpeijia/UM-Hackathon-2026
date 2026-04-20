"use client";

import { useMemo, useState, type CSSProperties } from "react";

type OperatingExpenseRow = {
  expense_type: string;
  amount: number;
};

type SupplierInvoiceRow = {
  item_category: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_amount: number;
};

type ScannedDocument = {
  file_name: string;
  document_type: "pl_statement" | "supplier_invoice" | "mixed";
  operating_expenses: OperatingExpenseRow[];
  supplier_invoices: SupplierInvoiceRow[];
};

type ProcessResult = {
  summary_id: string;
  merchant_id: string;
  report_month: string;
  total_revenue: number;
  total_fixed_costs: number;
  total_ingredient_costs: number;
  net_profit: number;
  category_revenue: Record<string, number>;
  sales_logs_rows: number;
  operating_expenses_rows: number;
  supplier_invoices_rows: number;
};

type Props = {
  merchantId?: string;
};

const API_BASE = "http://localhost:8001";

export default function ZeroDataEntryOnboarding({ merchantId }: Props) {
  const [merchantIdInput, setMerchantIdInput] = useState(merchantId || "");
  const [merchantProfile, setMerchantProfile] = useState("");
  const [reportMonth, setReportMonth] = useState("");

  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [salesCsvFile, setSalesCsvFile] = useState<File | null>(null);

  const [scannedDocuments, setScannedDocuments] = useState<ScannedDocument[]>([]);
  const [scanErrors, setScanErrors] = useState<string[]>([]);

  const [scanLoading, setScanLoading] = useState<"statement" | "invoice" | null>(null);
  const [processing, setProcessing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);

  const totalsPreview = useMemo(() => {
    const fixedCosts = scannedDocuments
      .flatMap((d) => d.operating_expenses)
      .reduce((sum, row) => sum + toNumber(row.amount, 0), 0);

    const ingredientCosts = scannedDocuments
      .flatMap((d) => d.supplier_invoices)
      .reduce((sum, row) => sum + toNumber(row.total_amount, 0), 0);

    return {
      fixedCosts: round2(fixedCosts),
      ingredientCosts: round2(ingredientCosts),
    };
  }, [scannedDocuments]);

  const scanSingleDocument = async (file: File, scanKind: "statement" | "invoice") => {
    setError(null);
    setSuccessMessage(null);
    setProcessResult(null);

    if (!merchantIdInput.trim()) {
      setError("merchant_id is required.");
      return;
    }

    if (!merchantProfile.trim()) {
      setError("Please enter a 3-sentence merchant profile.");
      return;
    }

    try {
      setScanLoading(scanKind);

      const fileDataUrl = await fileToDataUrl(file);
      const res = await fetch(API_BASE + "/analyze-financial-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: file.name, file_data_url: fileDataUrl }),
      });

      const body = await safeParseJson(res);
      if (!res.ok) {
        throw new Error(body?.detail || `Failed to scan ${file.name}`);
      }

      const scannedDoc: ScannedDocument = {
        file_name: body.file_name,
        document_type: body.document_type,
        operating_expenses: body.operating_expenses || [],
        supplier_invoices: body.supplier_invoices || [],
      };

      setScannedDocuments((prev) => {
        const filtered = prev.filter((d) => d.file_name !== scannedDoc.file_name);
        return [...filtered, scannedDoc];
      });

      setScanErrors((prev) => prev.filter((msg) => !msg.startsWith(`${file.name}:`)));
      setSuccessMessage(`Scanned ${file.name} successfully.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error while scanning file.";
      setError(message);
      setScanErrors((prev) => [...prev, `${file.name}: ${message}`]);
    } finally {
      setScanLoading(null);
    }
  };

  const handleScanStatement = async () => {
    if (!statementFile) {
      setError("Please choose a statement file first.");
      return;
    }
    await scanSingleDocument(statementFile, "statement");
  };

  const handleScanInvoice = async () => {
    if (!invoiceFile) {
      setError("Please choose an invoice file first.");
      return;
    }
    await scanSingleDocument(invoiceFile, "invoice");
  };

  const handleProcessMonthlyUpload = async () => {
    setError(null);
    setSuccessMessage(null);
    setProcessResult(null);

    if (!merchantIdInput.trim()) {
      setError("merchant_id is required.");
      return;
    }

    if (!merchantProfile.trim()) {
      setError("Please enter a 3-sentence merchant profile.");
      return;
    }

    if (!reportMonth.trim()) {
      setError("report_month is required (YYYY-MM).");
      return;
    }

    if (!salesCsvFile) {
      setError("Please upload Sales Records CSV.");
      return;
    }

    try {
      setProcessing(true);
      const salesCsvDataUrl = await fileToDataUrl(salesCsvFile);

      const payload = {
        merchant_id: merchantIdInput.trim(),
        merchant_profile: merchantProfile.trim(),
        report_month: reportMonth.trim(),
        scanned_documents: scannedDocuments,
        sales_csv_data_url: salesCsvDataUrl,
      };

      const res = await fetch(API_BASE + "/process-monthly-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await safeParseJson(res);
      if (!res.ok) {
        throw new Error(body?.detail || "Failed to process monthly upload.");
      }

      setProcessResult(body as ProcessResult);
      setSuccessMessage("Monthly reconciliation completed and saved to Supabase.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error while processing monthly upload.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <h2 style={styles.heading}>Monthly Financial Upload</h2>
      <p style={styles.subheading}>Tauke.ai AI-CFO Pipeline: Scan P&L + Invoices, then reconcile with Sales CSV.</p>

      <section style={styles.card}>
        <h3 style={styles.sectionHeading}>Phase 0: Merchant Setup</h3>
        <label style={styles.label}>merchant_id</label>
        <input
          style={styles.input}
          value={merchantIdInput}
          onChange={(e) => setMerchantIdInput(e.target.value)}
          placeholder="e.g. c6417c1f-56ee-4f6a-bab8-def781d9418f"
        />

        <label style={styles.label}>Merchant Profile (3 sentences: F&B Type, Location, Audience)</label>
        <textarea
          style={styles.textarea}
          rows={4}
          value={merchantProfile}
          onChange={(e) => setMerchantProfile(e.target.value)}
          placeholder="Example: We are a campus kopitiam serving coffee and rice bowls. We are located near UM lecture halls. Our main audience is students and campus staff."
        />

        <label style={styles.label}>report_month (YYYY-MM)</label>
        <input
          style={styles.input}
          value={reportMonth}
          onChange={(e) => setReportMonth(e.target.value)}
          placeholder="2026-04"
        />
      </section>

      <section style={styles.card}>
        <h3 style={styles.sectionHeading}>Phase 1: Upload & Scan Financial Documents</h3>
        <p style={styles.hint}>Upload and scan statements and invoices separately.</p>

        <label style={styles.label}>P&L Statement (image/pdf)</label>
        <input
          style={styles.input}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/jpg"
          onChange={(e) => setStatementFile(e.target.files?.[0] || null)}
        />
        <button style={styles.button} onClick={handleScanStatement} disabled={scanLoading !== null}>
          {scanLoading === "statement" ? "Scanning Statement..." : "Upload Statement"}
        </button>

        {statementFile ? <p style={styles.meta}>Statement file: {statementFile.name}</p> : null}

        <label style={styles.label}>Supplier Invoice / SOA (image/pdf)</label>
        <input
          style={styles.input}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/jpg"
          onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
        />

        <button style={styles.button} onClick={handleScanInvoice} disabled={scanLoading !== null}>
          {scanLoading === "invoice" ? "Scanning Invoice..." : "Upload Invoice"}
        </button>

        {invoiceFile ? <p style={styles.meta}>Invoice file: {invoiceFile.name}</p> : null}

        {scanErrors.length ? (
          <div style={styles.warnBox}>
            {scanErrors.map((msg) => (
              <div key={msg}>- {msg}</div>
            ))}
          </div>
        ) : null}
      </section>

      <section style={styles.card}>
        <h3 style={styles.sectionHeading}>Phase 2: Sales Records CSV</h3>
        <p style={styles.hint}>Upload monthly sales CSV to calculate total_revenue and category_revenue.</p>
        <input
          style={styles.input}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setSalesCsvFile(e.target.files?.[0] || null)}
        />

        {salesCsvFile ? <p style={styles.meta}>Sales CSV: {salesCsvFile.name}</p> : null}
      </section>

      <section style={styles.card}>
        <h3 style={styles.sectionHeading}>Scanned Output Preview</h3>
        <p style={styles.meta}>P&L rows: {scannedDocuments.flatMap((d) => d.operating_expenses).length}</p>
        <p style={styles.meta}>Invoice rows: {scannedDocuments.flatMap((d) => d.supplier_invoices).length}</p>
        <p style={styles.meta}>Estimated fixed costs: RM {totalsPreview.fixedCosts.toFixed(2)}</p>
        <p style={styles.meta}>Estimated ingredient costs: RM {totalsPreview.ingredientCosts.toFixed(2)}</p>

        {scannedDocuments.length ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th>Rows Extracted</th>
                </tr>
              </thead>
              <tbody>
                {scannedDocuments.map((doc) => (
                  <tr key={doc.file_name}>
                    <td>{doc.file_name}</td>
                    <td>{doc.document_type}</td>
                    <td>
                      {doc.document_type === "pl_statement"
                        ? doc.operating_expenses.length
                        : doc.document_type === "supplier_invoice"
                          ? doc.supplier_invoices.length
                          : doc.operating_expenses.length + doc.supplier_invoices.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={styles.hint}>No scanned output yet.</p>
        )}

        <button style={styles.button} onClick={handleProcessMonthlyUpload} disabled={processing}>
          {processing ? "Processing..." : "Process Monthly Upload"}
        </button>
      </section>

      {error ? <div style={styles.error}>{error}</div> : null}
      {successMessage ? <div style={styles.success}>{successMessage}</div> : null}

      {processResult ? (
        <section style={styles.card}>
          <h3 style={styles.sectionHeading}>Monthly Summary Saved</h3>
          <div style={styles.kv}>summary_id: {processResult.summary_id}</div>
          <div style={styles.kv}>merchant_id: {processResult.merchant_id}</div>
          <div style={styles.kv}>report_month: {processResult.report_month}</div>
          <div style={styles.kv}>total_revenue: RM {processResult.total_revenue.toFixed(2)}</div>
          <div style={styles.kv}>total_fixed_costs: RM {processResult.total_fixed_costs.toFixed(2)}</div>
          <div style={styles.kv}>total_ingredient_costs: RM {processResult.total_ingredient_costs.toFixed(2)}</div>
          <div style={styles.kv}>net_profit: RM {processResult.net_profit.toFixed(2)}</div>
          <div style={styles.kv}>sales_logs rows: {processResult.sales_logs_rows}</div>
          <div style={styles.kv}>operating_expenses rows: {processResult.operating_expenses_rows}</div>
          <div style={styles.kv}>supplier_invoices rows: {processResult.supplier_invoices_rows}</div>
        </section>
      ) : null}
    </div>
  );
}

async function safeParseJson(response: Response): Promise<any | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Failed to read uploaded file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read uploaded file."));
    reader.readAsDataURL(file);
  });
}

function toNumber(value: string | number | undefined | null, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "24px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  heading: {
    marginBottom: 8,
  },
  sectionHeading: {
    margin: "0 0 8px 0",
  },
  subheading: {
    marginTop: 0,
    color: "#555",
  },
  card: {
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: 16,
    marginTop: 16,
    background: "#fff",
  },
  label: {
    display: "block",
    marginBottom: 6,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #bbb",
    marginBottom: 12,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #bbb",
    marginBottom: 12,
    resize: "vertical",
  },
  button: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#0f766e",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  hint: {
    color: "#555",
    marginTop: 0,
  },
  meta: {
    color: "#333",
    margin: "8px 0",
  },
  tableWrap: {
    overflowX: "auto",
    marginBottom: 12,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  kv: {
    marginBottom: 6,
  },
  warnBox: {
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
};
