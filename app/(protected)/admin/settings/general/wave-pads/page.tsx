"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Trash2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/notify";

interface Row { _id: string; wave: string; pad: string; discovered: boolean }

const fmt = (w: string) => {
    const [h, m] = w.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export default function WavePadsPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [single, setSingle] = useState(true);
    const [loading, setLoading] = useState(true);
    const [newWave, setNewWave] = useState("");
    const [newPad, setNewPad] = useState("");

    const load = useCallback(async () => {
        const r = await fetch("/api/admin/settings/wave-pads");
        const j = await r.json();
        setRows(j.rows || []);
        setSingle(j.single !== false);
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async (wave: string, pad: string) => {
        const r = await fetch("/api/admin/settings/wave-pads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wave, pad }) });
        const j = await r.json();
        if (!r.ok) { notify.error(j.error || "Failed to save"); return false; }
        return true;
    };

    const setPad = async (row: Row, pad: string) => {
        if (pad === row.pad && !row.discovered) return;
        if (await save(row.wave, pad)) load();
    };

    const add = async () => {
        if (!newWave.trim()) return;
        if (await save(newWave, newPad)) { setNewWave(""); setNewPad(""); load(); }
    };

    const remove = async (id: string) => {
        await fetch(`/api/admin/settings/wave-pads?id=${id}`, { method: "DELETE" });
        load();
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
    const needs = rows.filter((r) => r.discovered && !r.pad).length;

    return (
        <div className="max-w-xl space-y-4 py-4">
            <div>
                <h2 className="text-lg font-semibold">Wave time → default PAD</h2>
                <p className="text-sm text-muted-foreground">
                    Set per station (use the station switcher). Wave time is the planned departure minus 20 minutes.
                    New wave times the sync hasn't seen appear here automatically so you can set their PAD.
                </p>
            </div>
            {!single && <p className="text-sm text-amber-500">Select a single station to edit its wave times.</p>}
            {needs > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                    <Sparkles className="h-4 w-4 text-amber-500" /> {needs} new wave time{needs > 1 ? "s" : ""} need a PAD.
                </div>
            )}
            <div className="rounded-xl border border-border/60 divide-y divide-border/50">
                {rows.length === 0 && <div className="p-4 text-sm text-muted-foreground">No wave times yet — they'll appear after the next sync, or add one below.</div>}
                {rows.map((r) => (
                    <div key={r._id} className="flex items-center gap-3 px-3 py-2">
                        <div className="w-28 font-medium tabular-nums">{fmt(r.wave)}</div>
                        {r.discovered && !r.pad && <span className="text-[10px] uppercase tracking-wide rounded bg-amber-500/20 text-amber-500 px-1.5 py-0.5">new</span>}
                        <Input
                            key={r._id + r.pad}
                            defaultValue={r.pad}
                            placeholder="PAD"
                            disabled={!single}
                            className="h-8 w-24 ml-auto"
                            onBlur={(e) => setPad(r, e.target.value.trim())}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!single} onClick={() => remove(r._id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <Input value={newWave} onChange={(e) => setNewWave(e.target.value)} placeholder="Wave, e.g. 11:35 AM" className="h-8 w-44" disabled={!single} />
                <Input value={newPad} onChange={(e) => setNewPad(e.target.value)} placeholder="PAD" className="h-8 w-24" disabled={!single} />
                <Button size="sm" onClick={add} disabled={!single} className="gap-1"><Plus className="h-3.5 w-3.5" />Add</Button>
            </div>
        </div>
    );
}
