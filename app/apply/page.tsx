"use client";

import { useState, useEffect } from "react";

type FormStep = "form" | "submitting" | "success";

const WORK_TYPES = [
  "Full-Time",
  "Part-Time",
  "Seasonal",
  "Flexible",
];

const WORK_DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

const HEAR_OPTIONS = [
  "Indeed", "Craigslist", "Facebook", "Instagram", "Referral", "Walk-In", "Other",
];

const DISCLAIMER_TEXT = `I understand my job classification is eligible for overtime and/or compensatory time payment. I consent to and authorize the Company to contact my former employers, and any and all other persons and organizations for information bearing upon my qualifications for employment. Unless I noted otherwise, I further authorize the listed employers, schools, and personal references to give the Company (without further notice to me) any and all information about my previous employment and education, along with other pertinent information they may have and hereby waive any actions which I may have against either party/parties for providing a reference as part of this application process. I understand that any employment or offer of employment arising from this Application for Employment will be subject to satisfactory verification of all job qualifications and information contained in this Application for Employment. I expressly agree and understand that completion of this application is a preliminary step to employment. It does not obligate the Company to offer me employment or for me to accept employment. I further agree and understand that in the event I am employed by the Company, my employment with the Company will be "at will." This means that my employment is not for a specified term and that it may be terminated by the Company or me at any time, for any reason, with or without cause or notice.`;

export default function ApplyPage() {
  const [step, setStep] = useState<FormStep>("form");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [workStart, setWorkStart] = useState("");
  const [typeOfWork, setTypeOfWork] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [experience, setExperience] = useState("");
  const [howHeard, setHowHeard] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    const body = document.body;
    const orig = body.style.overflow;
    const origH = body.style.height;
    body.style.overflow = "auto";
    body.style.height = "auto";
    return () => { body.style.overflow = orig; body.style.height = origH; };
  }, []);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) return;
    setStep("submitting");
    try {
      const res = await fetch("/api/public/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phoneNumber: phone.trim(),
          workStartDate: workStart,
          typeOfWork,
          workDays: selectedDays.join(", "),
          lastEmployerInfo: experience.trim(),
          howDidYouHear: howHeard,
          disclaimer: agreed ? "Agreed" : "",
        }),
      });
      if (!res.ok) throw new Error();
      setStep("success");
    } catch {
      setStep("form");
      alert("Failed to submit. Please try again.");
    }
  };

  const handleReset = () => {
    setStep("form");
    setFullName("");
    setPhone("");
    setWorkStart("");
    setTypeOfWork("");
    setSelectedDays([]);
    setExperience("");
    setHowHeard("");
    setAgreed(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-start justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[600px] h-[600px] rounded-full bg-rose-500/5 blur-3xl" />
        <div className="absolute -bottom-[30%] -left-[10%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg my-8">
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="relative px-6 pt-8 pb-6 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-rose-500/10 to-transparent" />
            <div className="relative">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-4 ring-2 ring-white/5">
                <img src="/sidebar-icon.png" alt="SYMX" className="w-10 h-10 rounded-lg" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Employment Application</h1>
              <p className="text-sm text-zinc-400 mt-1.5">SYMX Logistics — Join Our Team</p>
            </div>
          </div>

          {/* ── FORM ── */}
          {step === "form" && (
            <div className="px-6 pb-8 space-y-5">
              {/* Full Name */}
              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Enter your Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 transition-all"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Enter your Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 transition-all"
                />
              </div>

              {/* Work Start Date */}
              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  What day are you available to start work?
                </label>
                <input
                  type="date"
                  value={workStart}
                  onChange={(e) => setWorkStart(e.target.value)}
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 transition-all"
                />
              </div>

              {/* Type of Work */}
              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  What type of work are you looking for?
                </label>
                <div className="flex flex-wrap gap-2">
                  {WORK_TYPES.map((wt) => (
                    <button
                      key={wt}
                      onClick={() => setTypeOfWork(wt)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        typeOfWork === wt
                          ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25 scale-[1.02]"
                          : "bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                      }`}
                    >
                      {wt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Work Days */}
              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Please select the days which you are able to work
                </label>
                <div className="flex flex-wrap gap-2">
                  {WORK_DAYS.map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        selectedDays.includes(day)
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                          : "bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
                {selectedDays.length > 0 && (
                  <p className="text-[11px] text-emerald-400/70 mt-1.5">{selectedDays.length} day{selectedDays.length !== 1 ? "s" : ""} selected</p>
                )}
              </div>

              {/* Past Experience */}
              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  Past work experience
                </label>
                <textarea
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="Where did you work? Do you have any relevant work experience?"
                  rows={3}
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 resize-none transition-all"
                />
              </div>

              {/* How did you hear */}
              <div>
                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                  How did you hear about us?
                </label>
                <div className="flex flex-wrap gap-2">
                  {HEAR_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setHowHeard(opt)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        howHeard === opt
                          ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                          : "bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setAgreed(!agreed)}
                    className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      agreed
                        ? "bg-rose-500 border-rose-500"
                        : "border-zinc-600 hover:border-zinc-400"
                    }`}
                  >
                    {agreed && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 font-medium mb-1">Employment Application Agreement</p>
                    <p className={`text-[11px] text-zinc-500 leading-relaxed ${showDisclaimer ? "" : "line-clamp-3"}`}>
                      {DISCLAIMER_TEXT}
                    </p>
                    <button
                      onClick={() => setShowDisclaimer(!showDisclaimer)}
                      className="text-[10px] text-rose-400 font-semibold mt-1 hover:underline"
                    >
                      {showDisclaimer ? "Show less" : "Read full agreement"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!fullName.trim()}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 text-white text-base font-bold shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Submit Application
              </button>
            </div>
          )}

          {/* ── SUBMITTING ── */}
          {step === "submitting" && (
            <div className="px-6 pb-10 flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-[3px] border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
              <p className="text-sm text-zinc-400">Submitting your application…</p>
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
              <h2 className="text-lg font-bold text-white mb-1">Application Submitted!</h2>
              <p className="text-zinc-400 text-sm mb-2">
                Thank you for your interest in SYMX Logistics.
              </p>
              <p className="text-zinc-500 text-xs mb-6">
                Our HR team will review your application and contact you if selected for an interview.
              </p>
              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-xl bg-zinc-800/80 text-zinc-300 text-sm font-semibold border border-zinc-700/60 hover:border-rose-500/40 hover:text-rose-400 transition-all"
              >
                Submit Another Application
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-800/80 flex flex-col items-center gap-2">
            <div className="bg-white rounded-xl px-4 py-2 shadow-lg shadow-rose-500/10">
              <img src="/symx-logo.png" alt="SYMX Logistics" className="h-6 object-contain" />
            </div>
            <p className="text-zinc-600 text-[10px]">Powered by SYMX Systems</p>
          </div>
        </div>
      </div>
    </div>
  );
}
