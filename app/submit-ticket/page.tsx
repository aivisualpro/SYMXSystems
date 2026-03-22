"use client";

import { useState, useEffect } from "react";

type FormStep = "form" | "submitting" | "success";

const CATEGORIES = [
  "Payroll Issue",
  "Schedule Change",
  "Benefits Question",
  "Leave Request",
  "Equipment Issue",
  "Safety Concern",
  "Workplace Complaint",
  "Policy Question",
  "Training Request",
  "Other",
];

export default function SubmitTicketPage() {
  const [step, setStep] = useState<FormStep>("form");
  const [category, setCategory] = useState("");
  const [issue, setIssue] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Override root layout overflow so this public page can scroll
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

  const handleSubmit = async () => {
    if (!category) return;
    if (!issue.trim()) return;

    setStep("submitting");

    try {
      const res = await fetch("/api/public/hr-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          issue: issue.trim(),
          notes: notes.trim(),
          submitterName: submitterName.trim(),
          managersEmail: submitterEmail.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");
      setStep("success");
    } catch {
      setStep("form");
      alert("Failed to submit ticket. Please try again.");
    }
  };

  const handleReset = () => {
    setStep("form");
    setCategory("");
    setIssue("");
    setSubmitterName("");
    setSubmitterEmail("");
    setNotes("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-start justify-center p-4 overflow-y-auto">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-3xl" />
        <div className="absolute -bottom-[30%] -left-[10%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg my-8">
        {/* Main Card */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="relative px-6 pt-8 pb-6 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 to-transparent" />
            <div className="relative">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-4 ring-2 ring-white/5">
                <img src="/sidebar-icon.png" alt="SYMX" className="w-10 h-10 rounded-lg" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Submit HR Ticket</h1>
              <p className="text-sm text-zinc-400 mt-1.5">SYMX Logistics — HR Support</p>
            </div>
          </div>

          {/* ── FORM ── */}
          {step === "form" && (
            <div className="px-6 pb-8 space-y-5">
              {/* Name */}
              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Your Email
                </label>
                <input
                  type="email"
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Category <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        category === cat
                          ? "bg-purple-500 text-white shadow-lg shadow-purple-500/25 scale-[1.02]"
                          : "bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Issue */}
              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Describe your issue <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  placeholder="Please describe your issue in detail..."
                  rows={4}
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 resize-none transition-all"
                />
              </div>

              {/* Additional Notes */}
              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Additional Notes <span className="text-zinc-600">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional context..."
                  rows={2}
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 resize-none transition-all"
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!category || !issue.trim()}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 text-white text-base font-bold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Submit Ticket
              </button>
            </div>
          )}

          {/* ── SUBMITTING ── */}
          {step === "submitting" && (
            <div className="px-6 pb-10 flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-[3px] border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              <p className="text-sm text-zinc-400">Submitting your ticket…</p>
            </div>
          )}

          {/* ── SUCCESS ── */}
          {step === "success" && (
            <div className="px-6 pb-10 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-5 ring-4 ring-emerald-500/20">
                <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white mb-1">Ticket Submitted!</h2>
              <p className="text-zinc-400 text-sm mb-6">
                Your HR ticket has been submitted successfully. Our team will review it shortly.
              </p>
              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-xl bg-zinc-800/80 text-zinc-300 text-sm font-semibold border border-zinc-700/60 hover:border-purple-500/40 hover:text-purple-400 transition-all"
              >
                Submit Another Ticket
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-800/80 flex flex-col items-center gap-2">
            <div className="bg-white rounded-xl px-4 py-2 shadow-lg shadow-purple-500/10">
              <img src="/symx-logo.png" alt="SYMX Logistics" className="h-6 object-contain" />
            </div>
            <p className="text-zinc-600 text-[10px]">Powered by SYMX Systems</p>
          </div>
        </div>
      </div>
    </div>
  );
}
