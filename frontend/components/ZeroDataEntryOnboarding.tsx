"use client";

import { useMemo, useState, type CSSProperties } from "react";

type MenuItem = {
  item_name: string;
  original_price: number;
  estimated_cogs: number;
  ingredients_list: string;
  required_hardware: string;
  prep_time_seconds: number;
  approved: boolean;
};

type BackendMenuItem = {
  item_name?: string;
  original_price?: string | number;
  estimated_cogs?: string | number;
  ingredients_list?: string;
  required_hardware?: string;
  prep_time_seconds?: string | number;
};

type AnalyzeResponse = {
  items: BackendMenuItem[];
};

type Props = {
  merchantId?: string;
};

const API_BASE = "http://localhost:8001";

export default function ZeroDataEntryOnboarding({ merchantId }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [merchantIdInput, setMerchantIdInput] = useState(merchantId || "");
  const [imageUrl, setImageUrl] = useState("");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [approvedItems, setApprovedItems] = useState<MenuItem[]>([]);
  const [hardwareInventory, setHardwareInventory] = useState<Record<string, number>>({});
  const [staffCount, setStaffCount] = useState<number>(1);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const uniqueHardware = useMemo(() => {
    const set = new Set<string>();
    approvedItems.forEach((item) => {
      extractHardwareTypes(item.required_hardware).forEach((key) => set.add(key));
    });
    return Array.from(set);
  }, [approvedItems]);

  const handleAnalyzeMenu = async () => {
    setError(null);
    setSuccessMessage(null);

    if (!imageUrl.trim()) {
      setError("Please provide a valid image URL.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(API_BASE + "/analyze-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl.trim() }),
      });

      if (!res.ok) {
        const errBody = await safeParseJson(res);
        throw new Error(errBody?.detail || "Failed to analyze menu image.");
      }

      const data: AnalyzeResponse = await res.json();
      const normalized: MenuItem[] = (data.items || []).map((item) => {
        const originalPrice = parseCurrencyToNumber(item.original_price);
        const estimatedCogs = parseCurrencyToNumber(item.estimated_cogs);

        return {
          item_name: item.item_name || "",
          original_price: originalPrice,
          estimated_cogs: estimatedCogs,
          ingredients_list: item.ingredients_list || "",
          required_hardware: item.required_hardware || "",
          prep_time_seconds: toNumber(item.prep_time_seconds, 60),
          approved: true,
        };
      });

      if (!normalized.length) {
        throw new Error("No menu items were returned from the AI service.");
      }

      setItems(normalized);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error while analyzing menu.");
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index: number, key: keyof MenuItem, value: string | number | boolean) => {
    setItems((prev) => {
      const next = [...prev];
      const updated = { ...next[index], [key]: value };
      next[index] = updated;
      return next;
    });
  };

  const handleConfirmApprovedItems = () => {
    setError(null);
    setSuccessMessage(null);

    const filtered = items.filter((i) => i.approved);
    if (!filtered.length) {
      setError("Please approve at least one item before continuing.");
      return;
    }

    const hardwareDefaults: Record<string, number> = {};
    filtered.forEach((item) => {
      extractHardwareTypes(item.required_hardware).forEach((key) => {
        if (hardwareDefaults[key] === undefined) {
          hardwareDefaults[key] = 1;
        }
      });
    });

    setApprovedItems(filtered);
    setHardwareInventory(hardwareDefaults);
    setStep(3);
  };

  const handleCompleteSetup = async () => {
    setError(null);
    setSuccessMessage(null);

    const resolvedMerchantId = merchantIdInput.trim();
    if (!resolvedMerchantId) {
      setError("Missing merchant ID.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        merchant_id: resolvedMerchantId,
        approved_items: approvedItems.map(({ approved, ...rest }) => rest),
        hardware_inventory: hardwareInventory,
        staff_count: toNumber(staffCount, 0),
      };

      const res = await fetch(API_BASE + "/save-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await safeParseJson(res);
        throw new Error(errBody?.detail || "Failed to save onboarding data.");
      }

      setSuccessMessage("Setup completed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error while completing setup.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <h2 style={styles.heading}>Zero Data-Entry Onboarding</h2>
      <p style={styles.subheading}>Step {step} of 3</p>

      <section style={styles.card}>
        <label style={styles.label}>Merchant ID (UUID)</label>
        <input
          style={styles.input}
          value={merchantIdInput}
          onChange={(e) => setMerchantIdInput(e.target.value)}
          placeholder="e.g. c6417c1f-56ee-4f6a-bab8-def781d9418f"
        />
      </section>

      {error ? <div style={styles.error}>{error}</div> : null}
      {successMessage ? <div style={styles.success}>{successMessage}</div> : null}

      {step === 1 && (
        <section style={styles.card}>
          <label style={styles.label}>Menu Image URL</label>
          <input
            style={styles.input}
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/menu.jpg"
          />
          <button style={styles.button} onClick={handleAnalyzeMenu} disabled={loading}>
            {loading ? "Analyzing..." : "Upload & Analyze Menu"}
          </button>
          {loading ? <div style={styles.spinner}>Processing image with AI...</div> : null}
        </section>
      )}

      {step === 2 && (
        <section style={styles.card}>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Approve</th>
                  <th>Item Name</th>
                  <th>Price (RM)</th>
                  <th>COGS (RM)</th>
                  <th>Ingredients</th>
                  <th>Hardware</th>
                  <th>Prep Time (sec)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.item_name + "-" + idx}>
                    <td>
                      <input
                        type="checkbox"
                        checked={item.approved}
                        onChange={(e) => updateItem(idx, "approved", e.target.checked)}
                      />
                    </td>
                    <td>
                      <input
                        style={styles.cellInput}
                        value={item.item_name}
                        onChange={(e) => updateItem(idx, "item_name", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        style={styles.cellInput}
                        type="number"
                        step="0.01"
                        value={item.original_price}
                        onChange={(e) => updateItem(idx, "original_price", toNumber(e.target.value))}
                      />
                    </td>
                    <td>
                      <input
                        style={styles.cellInput}
                        type="number"
                        step="0.01"
                        value={item.estimated_cogs}
                        onChange={(e) => updateItem(idx, "estimated_cogs", toNumber(e.target.value))}
                      />
                    </td>
                    <td>
                      <input
                        style={styles.cellInput}
                        value={item.ingredients_list}
                        onChange={(e) => updateItem(idx, "ingredients_list", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        style={styles.cellInput}
                        value={item.required_hardware}
                        onChange={(e) => updateItem(idx, "required_hardware", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        style={styles.cellInput}
                        type="number"
                        value={item.prep_time_seconds}
                        onChange={(e) => updateItem(idx, "prep_time_seconds", toNumber(e.target.value, 60))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button style={styles.button} onClick={handleConfirmApprovedItems}>
            Confirm Approved Items
          </button>
        </section>
      )}

      {step === 3 && (
        <section style={styles.card}>
          <h3>Hardware Inventory</h3>
          {!uniqueHardware.length ? (
            <p>No hardware types detected from approved items.</p>
          ) : (
            uniqueHardware.map((hardware) => (
              <div key={hardware} style={styles.formRow}>
                <label style={styles.label}>How many {pluralizeHardwareLabel(hardware)} do you operate?</label>
                <input
                  style={styles.input}
                  type="number"
                  min={0}
                  value={hardwareInventory[hardware] ?? 0}
                  onChange={(e) =>
                    setHardwareInventory((prev) => ({
                      ...prev,
                      [hardware]: toNumber(e.target.value, 0),
                    }))
                  }
                />
              </div>
            ))
          )}

          <div style={styles.formRow}>
            <label style={styles.label}>Total Staff Count</label>
            <input
              style={styles.input}
              type="number"
              min={0}
              value={staffCount}
              onChange={(e) => setStaffCount(toNumber(e.target.value, 0))}
            />
          </div>

          <button style={styles.button} onClick={handleCompleteSetup} disabled={submitting}>
            {submitting ? "Saving..." : "Complete Setup"}
          </button>
        </section>
      )}
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

function toNumber(value: string | number | undefined | null, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseCurrencyToNumber(value: string | number | undefined | null, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function extractHardwareTypes(rawHardware: string | undefined): string[] {
  if (!rawHardware) {
    return [];
  }

  const unique = new Map<string, string>();

  rawHardware
    .split(/,|\/|\band\b|&/i)
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter((part) => part.length > 0)
    .forEach((part) => {
      const key = normalizeHardwareKey(part);
      if (!unique.has(key)) {
        unique.set(key, toTitleCase(key));
      }
    });

  return Array.from(unique.values());
}

function normalizeHardwareKey(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return "";
  }

  const words = cleaned.split(" ");
  const lastWord = words[words.length - 1];

  if (lastWord.endsWith("ies") && lastWord.length > 3) {
    words[words.length - 1] = lastWord.slice(0, -3) + "y";
  } else if (lastWord.endsWith("s") && !lastWord.endsWith("ss") && lastWord.length > 1) {
    words[words.length - 1] = lastWord.slice(0, -1);
  }

  return words.join(" ");
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function pluralizeHardwareLabel(hardware: string): string {
  if (hardware.endsWith("s")) {
    return hardware;
  }

  if (hardware.endsWith("y")) {
    return hardware.slice(0, -1) + "ies";
  }

  return hardware + "s";
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
  button: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#0f766e",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  spinner: {
    marginTop: 10,
    color: "#0f766e",
    fontWeight: 600,
  },
  tableWrap: {
    overflowX: "auto",
    marginBottom: 12,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  cellInput: {
    width: "100%",
    minWidth: 120,
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #bbb",
  },
  formRow: {
    marginBottom: 10,
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: 10,
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 8,
    padding: 10,
  },
};
