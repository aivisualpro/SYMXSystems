const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="rounded-xl border border-border/50 bg-card p-5"><h2 className="mb-2 text-base font-semibold">{title}</h2><div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div></section>
);

export default function GuidePage() {
    const timeline = [
        ["Mon–Sun", "Work happens", "Drivers run routes. Cortex and SYMX record routes, rescues, late departures and packages."],
        ["Within 2 days", "Fix the Work Summary Tool (WST)", "Submit a Change Request for wrong route counts, cancellations or delay time. Amazon can change up to 3 days after the work; after that it's locked."],
        ["Tuesday night", "Invoice is generated", "Amazon bills the previous week. The invoice appears in the payments portal and SYMX syncs it."],
        ["Wed–Fri", "Review (your 14-day window opens)", "Work the checklist on the invoice page. Dispute anything wrong. Do this early — the window is 14 days but disputes are far easier while the week is fresh."],
        ["Accept or dispute", "In Amazon's portal", "SYMX never clicks these for you. Accepting a variable invoice means you agree with it."],
        ["Later", "Adjustment invoice", "If a dispute succeeds Amazon issues an adjustment invoice. Mark the dispute won/partial/lost on the Disputes tab."],
    ];
    const types = [
        ["Weekly variable", "Routes × rate by service type, plus per-package and pickup pay, rescues, delay pay, training and late cancellations. This is where most mistakes happen and where SYMX's audit works."],
        ["Monthly fleet", "Per-vehicle payment. A prepayment for the new month plus a true-up of last month to the vehicles you actually had. Negative lines are clawbacks. Vehicles must be registered in Amazon's Fleet Management. Small prepayment disputes (under $5,000) are normally rejected."],
        ["Incentive / promotion", "Amazon-funded bonus money. It belongs to the drivers: Amazon audits payroll and requires a Corrective Action Plan if drivers aren't paid in full."],
        ["Adjustment", "Amazon's answer to a dispute, or a correction. Positive means they pay you more."],
    ];
    const checks = [
        ["Route count", "Compares routes billed per day with distinct routes Cortex shows delivering. Billed fewer than we ran = possible underpayment."],
        ["Rescues", "A route that another driver finished (hand-off) can be billed as a rescue block. Flags hand-offs with no rescue billed. Amazon must have authorized the rescue."],
        ["Late-departure pay", "Routes that left 15+ minutes after planned departure but have little or no delay pay billed. Only payable when Amazon caused the delay and a rep authorized it."],
        ["Package count", "Compares delivered packages in Cortex with packages billed. Flags gaps over 1%. Only shown when Cortex data covers every day of the period."],
        ["Pickups", "Pickups completed per Cortex versus pickups billed."],
        ["Rate change", "The rate for a service type differs from what that station usually gets billed. Check against your rate card."],
    ];
    return (
        <div className="grid gap-4 pb-12 lg:grid-cols-2">
            <div className="lg:col-span-2"><Card title="The 30-second version">
                <p>Amazon pays you through weekly and monthly invoices. Each invoice has a <b>14-day dispute window</b>. If you do nothing, you're accepting whatever Amazon billed. SYMX pulls every invoice automatically, checks it against what actually happened on the road, and tells you where you may have been short-paid — so your job each week is: <b>open the Overview, clear the deadline queue, work the checklist, dispute or accept.</b></p>
                <p>Everything in this section is visible to the Super Admin account only. Dispatchers and other admins can't see the page, the menu item, or the data.</p>
            </Card></div>

            <Card title="Money-flow timeline">
                <ol className="space-y-3">{timeline.map(([w, t, d]) => <li key={t} className="flex gap-3"><span className="w-24 shrink-0 text-xs font-semibold text-foreground">{w}</span><span><b className="text-foreground">{t}.</b> {d}</span></li>)}</ol>
            </Card>

            <Card title="Invoice types">
                <dl className="space-y-3">{types.map(([t, d]) => <div key={t}><dt className="font-semibold text-foreground">{t}</dt><dd>{d}</dd></div>)}</dl>
            </Card>

            <Card title="Your weekly routine (owner)">
                <ol className="list-decimal space-y-1.5 pl-5">
                    <li>Overview: look at <b>Needs action</b> and the countdowns. Anything under 72 hours is amber, under 24 is red.</li>
                    <li>Open each new weekly invoice and work the checklist top to bottom.</li>
                    <li>On the Audit tab, check every "possibly underpaid" item in the Work Summary Tool. Tick the ones that are real.</li>
                    <li>Click <b>Copy dispute packet</b>, file the dispute in Amazon (Open in Amazon), then <b>log it</b> here.</li>
                    <li>Nothing wrong? Click <b>Ready to accept</b>, accept in Amazon, then mark it Accepted.</li>
                    <li>Friday: check Disputes for adjustment invoices that arrived and record outcomes.</li>
                </ol>
            </Card>

            <Card title="CFO view: what to watch">
                <ul className="list-disc space-y-1.5 pl-5">
                    <li><b>Revenue per route</b> (weekly chart) — a sudden drop with the same route count means a rate or package problem.</li>
                    <li><b>Cash calendar</b> — when each invoice will actually pay out, so you can plan payroll and fleet costs.</li>
                    <li><b>Recovered vs claimed</b> — your dispute win rate tells you which kinds of claims are worth the time.</li>
                    <li><b>Fleet true-up</b> — negative lines on monthly fleet invoices mean Amazon paid for vehicles you didn't have registered.</li>
                    <li><b>Incentives</b> — track pass-through so a payroll audit never surprises you.</li>
                    <li><b>Separation of duties</b> — dispatchers run the routes and WST; only you see the money and accept invoices.</li>
                </ul>
            </Card>

            <div className="lg:col-span-2"><Card title="What the audit checks — and its limits">
                <dl className="grid gap-3 md:grid-cols-2">{checks.map(([t, d]) => <div key={t}><dt className="font-semibold text-foreground">{t}</dt><dd>{d}</dd></div>)}</dl>
                <p className="pt-2"><b className="text-foreground">Limits:</b> findings are leads, not guarantees. Route and package checks only work for days where SYMX captured Cortex data, and the invoice page shows how many days are covered. Amazon's WST is the source of truth for disputes. SYMX only reads from Amazon's portal — it never accepts or disputes for you.</p>
            </Card></div>

            <div className="lg:col-span-2"><Card title="Glossary">
                <dl className="grid gap-2 md:grid-cols-2">
                    {[["WST", "Work Summary Tool — where station staff and you record what each driver did each day."], ["UPD", "Unplanned delay — paid time when Amazon caused a late start."], ["Rescue block", "One driver finishing another driver's route, paid separately."], ["Dispute window", "14 days from invoice date to dispute."], ["Change Request", "Request to correct the WST, within 2–3 days of the work."], ["Adjustment invoice", "Amazon's correction after a dispute."]].map(([t, d]) => <div key={t}><dt className="inline font-semibold text-foreground">{t}: </dt><dd className="inline">{d}</dd></div>)}
                </dl>
            </Card></div>
        </div>
    );
}
