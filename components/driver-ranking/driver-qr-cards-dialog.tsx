"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Loader2, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DriverRankingRow } from "@/lib/driver-ranking/driver-ranking-data";
import { notify } from "@/lib/notify";

type Card = { driverId: string; name: string; rank: number | null; score: number | null; url: string; qr: string };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));

export function DriverQrCardsDialog({ drivers, week, enabled }: { drivers: DriverRankingRow[]; week: string; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) { setCards([]); setProgress(0); }
  }, [open]);

  async function buildCards() {
    if (!drivers.length) return;
    setLoading(true); setProgress(0);
    try {
      const next: Card[] = [];
      for (let index = 0; index < drivers.length; index += 1) {
        const driver = drivers[index];
        const response = await fetch("/api/driver-rankings/driver-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driverId: driver.driverId }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || `Could not create link for ${driver.name}.`);
        const url = `${window.location.origin}${body.path}`;
        const qr = await QRCode.toDataURL(url, { width: 420, margin: 1, errorCorrectionLevel: "M" });
        next.push({ driverId: driver.driverId, name: driver.name, rank: driver.score?.rank ?? null, score: driver.score?.finalScore ?? null, url, qr });
        setProgress(index + 1);
      }
      setCards(next);
      notify.success(`${next.length} driver QR cards ready`);
    } catch (error: any) {
      notify.error(error.message || "Could not generate driver QR cards.");
    } finally {
      setLoading(false);
    }
  }

  async function openDialog() {
    setOpen(true);
    if (!cards.length && !loading) void buildCards();
  }

  function printCards() {
    if (!cards.length) return;
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) { notify.error("Allow pop-ups to print QR cards."); return; }
    const cardHtml = cards.map(card => `
      <article class="card">
        <div class="brand">SYMX LOGISTICS</div>
        <div class="eyebrow">WEEKLY DRIVER PERFORMANCE · ${escapeHtml(week)}</div>
        <h1>${escapeHtml(card.name)}</h1>
        <div class="summary">
          <div><span>RANK</span><strong>${card.rank ? `#${card.rank}` : "N/A"}</strong></div>
          <div><span>SCORE</span><strong>${card.score === null ? "N/A" : card.score.toFixed(2)}</strong></div>
        </div>
        <img class="qr" src="${card.qr}" alt="Private driver performance QR code" />
        <p class="scan">Scan to view your private weekly performance</p>
        <p class="private">PRIVATE · FOR ${escapeHtml(card.name.toUpperCase())} ONLY</p>
      </article>`).join("");
    popup.document.write(`<!doctype html><html><head><title>SYMX Driver QR Cards - ${escapeHtml(week)}</title><style>
      @page{size:letter;margin:.35in}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111}
      .sheet{display:grid;grid-template-columns:1fr 1fr;gap:.18in}.card{height:4.75in;border:1px solid #d9d9d9;border-radius:14px;padding:.24in;text-align:center;break-inside:avoid;display:flex;flex-direction:column;align-items:center}
      .brand{font-size:12px;font-weight:800;letter-spacing:.12em;color:#1769ff}.eyebrow{margin-top:7px;font-size:9px;letter-spacing:.08em;color:#666}
      h1{font-size:20px;margin:12px 0 8px}.summary{display:flex;gap:34px;margin:2px 0 8px}.summary div{display:flex;flex-direction:column}.summary span{font-size:9px;color:#777}.summary strong{font-size:20px;margin-top:2px}
      .qr{width:2.25in;height:2.25in;object-fit:contain}.scan{font-size:12px;font-weight:700;margin:7px 0 3px}.private{font-size:8px;color:#777;margin:auto 0 0}
      @media print{.card{border-color:#bbb}}
    </style></head><body><main class="sheet">${cardHtml}</main><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    popup.document.close();
  }

  if (!enabled) return null;
  return <>
    <Button type="button" size="sm" variant="outline" onClick={() => void openDialog()}><QrCode className="size-4"/>Driver QR Cards</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Driver QR Cards</DialogTitle>
          <DialogDescription>Private permanent scorecard QR codes for {week}. Hand each card only to the named driver.</DialogDescription>
        </DialogHeader>
        {loading ? <div className="flex items-center gap-3 py-8"><Loader2 className="size-5 animate-spin"/><div><p className="text-sm font-medium">Creating private driver links and QR codes...</p><p className="text-xs text-muted-foreground">{progress} of {drivers.length}</p></div></div> : cards.length ? <>
          <div className="grid gap-2 sm:grid-cols-2">{cards.map(card => <div key={card.driverId} className="flex items-center gap-3 rounded-lg border p-3"><img src={card.qr} alt="" className="size-20"/><div className="min-w-0"><p className="truncate text-sm font-semibold">{card.name}</p><p className="text-xs text-muted-foreground">Rank {card.rank ? `#${card.rank}` : "N/A"} · Score {card.score === null ? "N/A" : card.score.toFixed(2)}</p><p className="mt-1 text-[10px] text-muted-foreground">Permanent private link</p></div></div>)}</div>
          <div className="flex justify-end"><Button type="button" onClick={printCards}><Printer className="size-4"/>Print {cards.length} Cards</Button></div>
        </> : <div className="py-8 text-center"><p className="text-sm text-muted-foreground">No driver cards generated.</p><Button className="mt-3" onClick={() => void buildCards()}>Generate QR Codes</Button></div>}
      </DialogContent>
    </Dialog>
  </>;
}
