"use client";

import { useState, useEffect, useRef } from "react";

type FormStep = "form" | "submitting" | "success";

const WORK_TYPES = ["Full-Time", "Part-Time", "Seasonal", "Flexible"];

// Sunday first, in calendar order.
const WORK_DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

const HEAR_OPTIONS = [
  "Indeed", "Craigslist", "Facebook", "Instagram", "Referral", "Walk-In", "Other",
];

const DISCLAIMER_TEXT = `I understand my job classification is eligible for overtime and/or compensatory time payment. I consent to and authorize the Company to contact my former employers, and any and all other persons and organizations for information bearing upon my qualifications for employment. Unless I noted otherwise, I further authorize the listed employers, schools, and personal references to give the Company (without further notice to me) any and all information about my previous employment and education, along with other pertinent information they may have and hereby waive any actions which I may have against either party/parties for providing a reference as part of this application process. I understand that any employment or offer of employment arising from this Application for Employment will be subject to satisfactory verification of all job qualifications and information contained in this Application for Employment. I expressly agree and understand that completion of this application is a preliminary step to employment. It does not obligate the Company to offer me employment or for me to accept employment. I further agree and understand that in the event I am employed by the Company, my employment with the Company will be "at will." This means that my employment is not for a specified term and that it may be terminated by the Company or me at any time, for any reason, with or without cause or notice.`;

const inputCls =
  "w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3.5 text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20 transition-all";
const inputErrCls = "!border-red-500/70 !ring-2 !ring-red-500/20";

function Question({
  n, label, hint, required, error, children,
}: {
  n: number; label: string; hint?: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div data-q={n}>
      <label className="block text-[15px] font-semibold text-white mb-1">
        <span className="text-rose-400 mr-1.5">{n}.</span>
        {label}
        {required ? <span className="text-red-400"> *</span> : <span className="text-zinc-500 font-normal text-xs ml-2">(optional)</span>}
      </label>
      {hint && <p className="text-xs text-zinc-400 mb-2.5 leading-relaxed">{hint}</p>}
      {!hint && <div className="mb-2" />}
      {children}
      {error && <p className="text-xs text-red-400 mt-1.5 font-medium">{error}</p>}
    </div>
  );
}

function Chip({
  active, onClick, children, color = "rose",
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: "rose" | "emerald" | "blue";
}) {
  const on =
    color === "emerald" ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20"
    : color === "blue" ? "bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20"
    : "bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-[0.97] ${
        active ? on : "bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:text-white hover:border-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}

export default function ApplyPage() {
  // The QR code / link printed per station carries ?station=CODE so the
  // application lands directly in that station's pipeline.
  const [station, setStation] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStation(params.get("station") || "");
  }, []);

  const [step, setStep] = useState<FormStep>("form");
  const [fullName, setFullName] = useState("");
  const [currentCity, setCurrentCity] = useState("");
  const [phone, setPhone] = useState("");
  const [workStart, setWorkStart] = useState("");
  const [typeOfWork, setTypeOfWork] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [hasExp, setHasExp] = useState<"" | "Yes" | "No">("");
  const [expDetails, setExpDetails] = useState("");
  const [driverDesc, setDriverDesc] = useState("");
  const [howHeard, setHowHeard] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const body = document.body;
    const orig = body.style.overflow;
    const origH = body.style.height;
    body.style.overflow = "auto";
    body.style.height = "auto";
    return () => { body.style.overflow = orig; body.style.height = origH; };
  }, []);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const toggleDay = (day: string) =>
    setSelectedDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      return WORK_DAYS.filter((d) => next.includes(d)); // keep Sun→Sat order
    });
  const allDays = selectedDays.length === WORK_DAYS.length;

  const clearErr = (k: string) => setErrors((e) => { if (!e[k]) return e; const { [k]: _, ...rest } = e; return rest; });

  // Count of the required questions answered, for the progress bar.
  const requiredDone = [
    fullName.trim(),
    currentCity.trim(),
    phone.replace(/\D/g, "").length >= 10,
    workStart,
    typeOfWork,
    selectedDays.length > 0,
    hasExp && (hasExp === "No" || expDetails.trim()),
  ].filter(Boolean).length;
  const requiredTotal = 7;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = "Please enter your full name.";
    if (!currentCity.trim()) e.city = "Please tell us what city you live in.";
    if (phone.replace(/\D/g, "").length < 10) e.phone = "Please enter a 10-digit phone number so we can reach you.";
    if (!workStart) e.workStart = "Please pick the first day you could start.";
    if (!typeOfWork) e.typeOfWork = "Please choose one.";
    if (selectedDays.length === 0) e.days = "Please select at least one day.";
    if (!hasExp) e.exp = "Please choose Yes or No.";
    else if (hasExp === "Yes" && !expDetails.trim()) e.expDetails = "Please tell us a little about your experience.";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    setErrors(e);
    setSubmitError("");
    const keys = Object.keys(e);
    if (keys.length) {
      const order = ["fullName", "city", "phone", "workStart", "typeOfWork", "days", "exp", "expDetails"];
      const first = order.find((k) => e[k]);
      const qMap: Record<string, number> = { fullName: 1, city: 2, phone: 3, workStart: 4, typeOfWork: 5, days: 6, exp: 7, expDetails: 7 };
      const el = formRef.current?.querySelector(`[data-q="${qMap[first!]}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setStep("submitting");
    try {
      const res = await fetch("/api/public/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          currentCity: currentCity.trim(),
          phoneNumber: phone.trim(),
          workStartDate: workStart,
          typeOfWork,
          workDays: selectedDays.join(", "),
          hasDeliveryExperience: hasExp,
          deliveryExperienceDetails: hasExp === "Yes" ? expDetails.trim() : "",
          driverDescription: driverDesc.trim(),
          howDidYouHear: howHeard,
          disclaimer: agreed ? "Agreed" : "",
          station,
        }),
      });
      if (!res.ok) throw new Error();
      setStep("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setStep("form");
      setSubmitError("Something went wrong sending your application. Please check your connection and try again.");
    }
  };

  const handleReset = () => {
    setStep("form");
    setFullName(""); setCurrentCity(""); setPhone(""); setWorkStart(""); setTypeOfWork("");
    setSelectedDays([]); setHasExp(""); setExpDetails(""); setDriverDesc(""); setHowHeard("");
    setAgreed(false); setErrors({}); setSubmitError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[600px] h-[600px] rounded-full bg-rose-500/5 blur-3xl" />
        <div className="absolute -bottom-[30%] -left-[10%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg my-4 sm:my-8">
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="relative px-6 pt-8 pb-5 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-rose-500/10 to-transparent" />
            <div className="relative">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center mb-4 ring-2 ring-white/5">
                <img src="/sidebar-icon.png" alt="SYMX" className="w-10 h-10 rounded-lg" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Join our driver team</h1>
              <p className="text-sm text-zinc-400 mt-1.5">Takes about 2 minutes. Fields marked <span className="text-red-400">*</span> are required.</p>
            </div>
          </div>

          {/* ── FORM ── */}
          {step === "form" && (
            <div ref={formRef} className="px-5 sm:px-6 pb-8 space-y-6">
              {/* Progress */}
              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1.5">
                  <span>{requiredDone === requiredTotal ? "All set — ready to submit!" : "Required questions answered"}</span>
                  <span>{requiredDone} of {requiredTotal}</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${(requiredDone / requiredTotal) * 100}%` }}
                  />
                </div>
              </div>

              <Question n={1} label="What's your full name?" required error={errors.fullName}>
                <input
                  type="text" autoComplete="name" value={fullName}
                  onChange={(e) => { setFullName(e.target.value); clearErr("fullName"); }}
                  placeholder="First and last name"
                  className={`${inputCls} ${errors.fullName ? inputErrCls : ""}`}
                />
              </Question>

              <Question n={2} label="What city do you currently live in?" required error={errors.city}>
                <input
                  type="text" autoComplete="address-level2" value={currentCity}
                  onChange={(e) => { setCurrentCity(e.target.value); clearErr("city"); }}
                  placeholder="e.g. Fontana"
                  className={`${inputCls} ${errors.city ? inputErrCls : ""}`}
                />
              </Question>

              <Question n={3} label="What's the best phone number to reach you?" required
                hint="We'll text or call this number about your application." error={errors.phone}>
                <input
                  type="tel" inputMode="tel" autoComplete="tel" value={phone}
                  onChange={(e) => { setPhone(e.target.value); clearErr("phone"); }}
                  placeholder="(555) 123-4567"
                  className={`${inputCls} ${errors.phone ? inputErrCls : ""}`}
                />
              </Question>

              <Question n={4} label="What's the first day you could start working?" required
                hint="Tap the box and pick a date from the calendar. If you could start right away, choose today."
                error={errors.workStart}>
                <input
                  type="date" value={workStart} min={todayStr}
                  onChange={(e) => { setWorkStart(e.target.value); clearErr("workStart"); }}
                  className={`${inputCls} ${errors.workStart ? inputErrCls : ""}`}
                />
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => { setWorkStart(todayStr); clearErr("workStart"); }}
                    className="text-xs font-semibold text-rose-400 hover:underline min-h-[32px]"
                  >
                    I can start right away (today)
                  </button>
                </div>
              </Question>

              <Question n={5} label="What type of work are you looking for?" required error={errors.typeOfWork}>
                <div className="flex flex-wrap gap-2">
                  {WORK_TYPES.map((wt) => (
                    <Chip key={wt} active={typeOfWork === wt} onClick={() => { setTypeOfWork(wt); clearErr("typeOfWork"); }}>
                      {wt}
                    </Chip>
                  ))}
                </div>
              </Question>

              <Question n={6} label="Which days can you work?" required
                hint="Select every day you're available." error={errors.days}>
                <div className="flex flex-wrap gap-2">
                  {WORK_DAYS.map((day) => (
                    <Chip key={day} color="emerald" active={selectedDays.includes(day)} onClick={() => { toggleDay(day); clearErr("days"); }}>
                      {day.slice(0, 3)}
                    </Chip>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <button
                    type="button"
                    onClick={() => { setSelectedDays(allDays ? [] : [...WORK_DAYS]); clearErr("days"); }}
                    className="text-xs font-semibold text-emerald-400 hover:underline min-h-[32px]"
                  >
                    {allDays ? "Clear all days" : "Select all 7 days"}
                  </button>
                  {selectedDays.length > 0 && (
                    <span className="text-[11px] text-emerald-400/80">
                      {selectedDays.length} day{selectedDays.length !== 1 ? "s" : ""} selected
                    </span>
                  )}
                </div>
              </Question>

              <Question n={7} label="Do you have previous Amazon or other delivery driving experience?" required error={errors.exp}>
                <div className="flex gap-2">
                  <Chip active={hasExp === "Yes"} onClick={() => { setHasExp("Yes"); clearErr("exp"); }}>Yes</Chip>
                  <Chip active={hasExp === "No"} onClick={() => { setHasExp("No"); clearErr("exp"); clearErr("expDetails"); }}>No</Chip>
                </div>
                {hasExp === "Yes" && (
                  <div className="mt-3">
                    <label className="block text-sm text-zinc-300 mb-1.5">
                      Great! Tell us a bit about it <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={expDetails} rows={3}
                      onChange={(e) => { setExpDetails(e.target.value); clearErr("expDetails"); }}
                      placeholder="Which company, what you drove, and about how long?"
                      className={`${inputCls} resize-none ${errors.expDetails ? inputErrCls : ""}`}
                    />
                    {errors.expDetails && <p className="text-xs text-red-400 mt-1.5 font-medium">{errors.expDetails}</p>}
                  </div>
                )}
              </Question>

              <Question n={8} label="How would you describe yourself as a driver?"
                hint="In your own words — for example safe, careful, on time, friendly.">
                <textarea
                  value={driverDesc} rows={3}
                  onChange={(e) => setDriverDesc(e.target.value)}
                  placeholder="Type your answer here"
                  className={`${inputCls} resize-none`}
                />
              </Question>

              <Question n={9} label="How did you hear about us?">
                <div className="flex flex-wrap gap-2">
                  {HEAR_OPTIONS.map((opt) => (
                    <Chip key={opt} color="blue" active={howHeard === opt} onClick={() => setHowHeard(howHeard === opt ? "" : opt)}>
                      {opt}
                    </Chip>
                  ))}
                </div>
              </Question>

              {/* Disclaimer */}
              <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setAgreed(!agreed)}
                    aria-pressed={agreed}
                    aria-label="Agree to the employment application agreement"
                    className={`mt-0.5 shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                      agreed ? "bg-rose-500 border-rose-500" : "border-zinc-600 hover:border-zinc-400"
                    }`}
                  >
                    {agreed && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 font-medium mb-1">I agree to the Employment Application Agreement</p>
                    <p className={`text-[11px] text-zinc-500 leading-relaxed ${showDisclaimer ? "" : "line-clamp-2"}`}>
                      {DISCLAIMER_TEXT}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowDisclaimer(!showDisclaimer)}
                      className="text-[11px] text-rose-400 font-semibold mt-1 hover:underline"
                    >
                      {showDisclaimer ? "Show less" : "Read full agreement"}
                    </button>
                  </div>
                </div>
              </div>

              {submitError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-3">
                  {submitError}
                </div>
              )}
              {Object.keys(errors).length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-3">
                  Almost there — please fix the highlighted question{Object.keys(errors).length > 1 ? "s" : ""} above.
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 text-white text-base font-bold shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Submit my application
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
              <h2 className="text-xl font-bold text-white mb-1">Thank you, {fullName.trim().split(" ")[0]}!</h2>
              <p className="text-zinc-300 text-sm mb-2">Your application has been received.</p>
              <p className="text-zinc-500 text-xs mb-6">
                Our HR team will review it and contact you at the phone number you gave us if you're selected for an interview.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-3 rounded-xl bg-zinc-800/80 text-zinc-300 text-sm font-semibold border border-zinc-700/60 hover:border-rose-500/40 hover:text-rose-400 transition-all"
              >
                Submit another application
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
