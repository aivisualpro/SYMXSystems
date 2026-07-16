"use client";

import { useState, useEffect, useRef } from "react";

type FormStep = "form" | "submitting" | "success";

interface LineItem {
  id: string;
  description: string;
  category: string;
  amount: string;
}

interface ReceiptFile {
  id: string;
  name: string;
  url?: string;
  uploading: boolean;
  error?: string;
}

const CATEGORIES = [
  "Fuel",
  "Parking & Tolls",
  "Vehicle Supplies",
  "Uniform",
  "Equipment",
  "Travel & Lodging",
  "Meals",
  "Phone / Data",
  "Other",
];

function newItem(): LineItem {
  return { id: Math.random().toString(36).slice(2), description: "", category: "", amount: "" };
}

export default function SubmitReimbursementPage() {
  const [step, setStep] = useState<FormStep>("form");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const [notes, setNotes] = useState("");
  const [receipts, setReceipts] = useState<ReceiptFile[]>([]);
  const [website, setWebsite] = useState(""); // honeypot
  const [errorMsg, setErrorMsg] = useState("");
  const [requestNumber, setRequestNumber] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const body = document.body;
    const origOverflow = body.style.overflow;
    const origHeight = body.style.height;
    body.style.overflow = "auto";
    body.style.height = "auto";
    return () => {
      body.style.overflow = origOverflow;
      body.style.height = origHeight;
    };
  }, []);

  const total = items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
  const validItems = items.filter((it) => it.description.trim() && parseFloat(it.amount) > 0);
  const canSubmit = submitterName.trim().length > 0 && validItems.length > 0 && !receipts.some((r) => r.uploading);

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, newItem()]);
  const removeItem = (id: string) => setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, 10);
    for (const file of files) {
      const id = Math.random().toString(36).slice(2);
      setReceipts((prev) => [...prev, { id, name: file.name, uploading: true }]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/public/reimbursement-upload", { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, uploading: false, error: data?.error || "Upload failed" } : r)));
          continue;
        }
        setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, uploading: false, url: data.secure_url } : r)));
      } catch {
        setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, uploading: false, error: "Upload failed" } : r)));
      }
    }
  };

  const removeReceipt = (id: string) => setReceipts((prev) => prev.filter((r) => r.id !== id));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStep("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/public/reimbursement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitterName: submitterName.trim(),
          submitterEmail: submitterEmail.trim(),
          date,
          items: validItems.map((it) => ({ description: it.description.trim(), category: it.category, amount: it.amount })),
          notes: notes.trim(),
          attachments: receipts.filter((r) => r.url).map((r) => r.url),
          website,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMsg(data?.error || "Failed to submit request. Please try again.");
        setStep("form");
        return;
      }

      setRequestNumber(data?.requestNumber || "");
      setStep("success");
    } catch {
      setErrorMsg("Failed to submit request. Please check your connection and try again.");
      setStep("form");
    }
  };

  const handleReset = () => {
    setStep("form");
    setSubmitterName("");
    setSubmitterEmail("");
    setDate(new Date().toISOString().slice(0, 10));
    setItems([newItem()]);
    setNotes("");
    setReceipts([]);
    setRequestNumber("");
    setErrorMsg("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-start justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute -bottom-[30%] -left-[10%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg my-8">
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl shadow-2xl overflow-hidden">
          <div className="relative px-6 pt-8 pb-6 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent" />
            <div className="relative">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-4 ring-2 ring-white/5">
                <img src="/sidebar-icon.png" alt="SYMX" className="w-10 h-10 rounded-lg" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Submit Reimbursement</h1>
              <p className="text-sm text-zinc-400 mt-1.5">SYMX Logistics — Expense Reimbursement</p>
            </div>
          </div>

          {step === "form" && (
            <div className="px-6 pb-8 space-y-5">
              {errorMsg && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                  {errorMsg}
                </div>
              )}

              <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Your Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Your Email
                </label>
                <input
                  type="email"
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
                <p className="text-[11px] text-zinc-600 mt-1.5">We'll email you a confirmation with your request number.</p>
              </div>

              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Date of Expense
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all [color-scheme:dark]"
                />
              </div>

              {/* Itemized expenses */}
              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Expenses <span className="text-red-400">*</span>
                </label>
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={item.id} className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500 font-medium">Item {idx + 1}</span>
                        {items.length > 1 && (
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-zinc-500 hover:text-red-400 text-xs transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, { description: e.target.value })}
                        placeholder="Description (e.g. Gas fill-up)"
                        className="w-full bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                      />
                      <div className="flex gap-2">
                        <select
                          value={item.category}
                          onChange={(e) => updateItem(item.id, { category: e.target.value })}
                          className="flex-1 bg-zinc-900/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                        >
                          <option value="">Category…</option>
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <div className="relative w-32">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.amount}
                            onChange={(e) => updateItem(item.id, { amount: e.target.value })}
                            placeholder="0.00"
                            className="w-full bg-zinc-900/60 border border-zinc-700/50 rounded-lg pl-6 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addItem}
                  className="mt-2 w-full py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-400 text-xs font-semibold hover:border-emerald-500/50 hover:text-emerald-400 transition-all"
                >
                  + Add another expense
                </button>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5">
                  <span className="text-xs text-emerald-300/80 font-medium">Total</span>
                  <span className="text-emerald-300 font-bold">${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Receipts */}
              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Receipts
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 rounded-xl border-2 border-dashed border-zinc-700 text-zinc-400 text-sm hover:border-emerald-500/50 hover:text-emerald-400 transition-all flex flex-col items-center gap-1"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Tap to attach photos of receipts
                </button>
                {receipts.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {receipts.map((r) => (
                      <div key={r.id} className="flex items-center justify-between bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs">
                        <span className="text-zinc-300 truncate flex-1">{r.name}</span>
                        {r.uploading && <span className="text-zinc-500 ml-2">Uploading…</span>}
                        {r.error && <span className="text-red-400 ml-2">{r.error}</span>}
                        {r.url && <span className="text-emerald-400 ml-2">✓</span>}
                        <button onClick={() => removeReceipt(r.id)} className="text-zinc-500 hover:text-red-400 ml-2">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything else worth mentioning..."
                  rows={3}
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 resize-none transition-all"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-base font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Submit Request
              </button>
            </div>
          )}

          {step === "submitting" && (
            <div className="px-6 pb-10 flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-[3px] border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-sm text-zinc-400">Submitting your request…</p>
            </div>
          )}

          {step === "success" && (
            <div className="px-6 pb-10 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-5 ring-4 ring-emerald-500/20">
                <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white mb-1">Request Submitted!</h2>
              <p className="text-zinc-400 text-sm mb-4">
                Your reimbursement request has been submitted successfully. Our team will review it shortly.
              </p>
              {requestNumber && (
                <div className="inline-block bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-5 py-3 mb-6">
                  <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider">Request Number</p>
                  <p className="text-white text-lg font-bold">#{requestNumber}</p>
                </div>
              )}
              {submitterEmail && (
                <p className="text-zinc-500 text-xs mb-6 -mt-2">A confirmation was sent to {submitterEmail}.</p>
              )}
              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-xl bg-zinc-800/80 text-zinc-300 text-sm font-semibold border border-zinc-700/60 hover:border-emerald-500/40 hover:text-emerald-400 transition-all"
              >
                Submit Another Request
              </button>
            </div>
          )}

          <div className="px-6 py-4 border-t border-zinc-800/80 flex flex-col items-center gap-2">
            <div className="bg-white rounded-xl px-4 py-2 shadow-lg shadow-emerald-500/10">
              <img src="/symx-logo.png" alt="SYMX Logistics" className="h-6 object-contain" />
            </div>
            <p className="text-zinc-600 text-[10px]">Powered by SYMX Systems</p>
          </div>
        </div>
      </div>
    </div>
  );
}
