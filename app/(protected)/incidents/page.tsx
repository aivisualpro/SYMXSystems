"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { notify } from "@/lib/notify";
import { Loader2, Plus, AlertTriangle, Trash2, Paperclip, Lock, PhoneCall, FileText, Camera, File as FileIcon } from "lucide-react";

interface Attachment { name: string; url: string; category: string }
interface ContactNote { date: string; contactedBy: string; method: string; note: string }

interface Incident {
  _id: string;
  transporterId: string;
  employeeName?: string;
  employeeId?: string;
  reportedDate?: string;
  incidentDate?: string;
  claimType?: string;
  van?: string;
  claimantName?: string;
  shortDescription?: string;
  claimNumber?: string;
  claimantLawyer?: string;
  claimStatus?: string;
  statusDetail?: string;
  coverageDescription?: string;
  claimIncurred?: string;
  employeeNotes?: string;
  supervisorNotes?: string;
  thirdPartyName?: string;
  thirdPartyPhone?: string;
  thirdPartyEmail?: string;
  withInsurance?: boolean;
  insurancePolicy?: string;
  insurancePolicyId?: string;
  paid?: number;
  reserved?: number;
  attachments?: Attachment[];
  policeReportFiled?: boolean;
  policeReportNumber?: string;
  medicalTreatmentRequired?: boolean;
  medicalTreatmentType?: string;
  witnesses?: string;
  thirdPartyInvolvementType?: string;
  contactLog?: ContactNote[];
  createdBy?: string;
}

interface EmployeeOption { transporterId: string; firstName: string; lastName: string; _id: string }
interface ClaimTypeOption { _id: string; description: string }
interface PolicyOption { _id: string; policyNumber: string; company: string; type: string; coversDate: boolean }

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-500 text-white border-blue-600",
  Open: "bg-amber-500 text-white border-amber-600",
  Close: "bg-emerald-500 text-white border-emerald-600",
};

const MEDICAL_TYPES = ["Triage", "First Aid", "Clinical", "Emergency", "Other"];
const THIRD_PARTY_TYPES = ["None", "Animal", "Person/Colleague", "Vehicle", "Equipment", "Other"];
const CONTACT_METHODS = ["Phone Call", "Text", "Email", "In Person"];
const ATTACHMENT_CATEGORIES: { key: string; label: string; icon: any }[] = [
  { key: "Report Form", label: "Incident Report Form", icon: FileText },
  { key: "Photo", label: "Photos", icon: Camera },
  { key: "Other", label: "Other Files", icon: FileIcon },
];

const EMPTY_QUICK_FORM = {
  transporterId: "", employeeName: "", incidentDate: new Date().toISOString().split("T")[0],
  claimType: "", van: "", shortDescription: "", employeeNotes: "",
  policeReportFiled: false, policeReportNumber: "",
  medicalTreatmentRequired: false, medicalTreatmentType: "",
  witnesses: "", thirdPartyInvolvementType: "None",
};

function money(n?: number) {
  if (n === undefined || n === null) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

async function uploadFiles(files: File[], category: string): Promise<Attachment[]> {
  if (files.length === 0) return [];
  const uploads = await Promise.all(
    files.map(async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("module", "Incidents");
      const r = await fetch("/api/upload/cloudinary", { method: "POST", body: fd });
      if (!r.ok) return null;
      const { url } = await r.json();
      return { name: file.name, url, category };
    })
  );
  return uploads.filter(Boolean) as Attachment[];
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [claimTypes, setClaimTypes] = useState<ClaimTypeOption[]>([]);

  // Quick-create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<any>(EMPTY_QUICK_FORM);
  const [creating, setCreating] = useState(false);
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [otherFiles, setOtherFiles] = useState<File[]>([]);

  // Detail / edit dialog
  const [selected, setSelected] = useState<Incident | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [policyOptions, setPolicyOptions] = useState<PolicyOption[]>([]);
  const [newContactMethod, setNewContactMethod] = useState(CONTACT_METHODS[0]);
  const [newContactNote, setNewContactNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/incidents?status=all");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load incidents");
      setIncidents(json.incidents || []);
      setCanManage(!!json.canManage);
    } catch (err: any) {
      notify.error(err.message || "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetch("/api/admin/employees?terminated=false&export=true&select=firstName,lastName,transporterId,status")
      .then((res) => res.json())
      .then((json) => {
        const list = (json.employees || json || []).map((e: any) => ({
          _id: e._id, transporterId: e.transporterId || "", firstName: e.firstName || "", lastName: e.lastName || "",
        }));
        setEmployees(list.sort((a: EmployeeOption, b: EmployeeOption) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)));
      })
      .catch(() => {});
    fetch("/api/admin/settings/dropdowns?type=claim type")
      .then((res) => res.json())
      .then((opts: any[]) => setClaimTypes((opts || []).filter((o) => o.isActive !== false).map((o) => ({ _id: o._id, description: o.description }))))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let rows = showClosed ? incidents : incidents.filter((i) => i.claimStatus !== "Close");
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter(
        (i) =>
          (i.employeeName || "").toLowerCase().includes(q) ||
          (i.shortDescription || "").toLowerCase().includes(q) ||
          (i.claimType || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [incidents, showClosed, searchQuery]);

  const summary = useMemo(() => {
    const open = incidents.filter((i) => i.claimStatus !== "Close").length;
    const closed = incidents.length - open;
    return { total: incidents.length, open, closed };
  }, [incidents]);

  // ── Quick create ──
  const openCreate = () => {
    setCreateForm(EMPTY_QUICK_FORM);
    setReportFiles([]);
    setPhotoFiles([]);
    setOtherFiles([]);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!createForm.transporterId) {
      notify.error("Employee is required");
      return;
    }
    if (!createForm.claimType) {
      notify.error("Incident type is required");
      return;
    }
    setCreating(true);
    try {
      const attachments = [
        ...(await uploadFiles(reportFiles, "Report Form")),
        ...(await uploadFiles(photoFiles, "Photo")),
        ...(await uploadFiles(otherFiles, "Other")),
      ];

      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...createForm, attachments }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create incident");
      notify.success("Incident reported");
      setCreateOpen(false);
      load();
    } catch (err: any) {
      notify.error(err.message || "Failed to create incident");
    } finally {
      setCreating(false);
    }
  };

  // ── Detail / edit ──
  const openDetail = (incident: Incident) => {
    setSelected(incident);
    setNewContactMethod(CONTACT_METHODS[0]);
    setNewContactNote("");
    setEditForm({
      claimStatus: incident.claimStatus || "New",
      shortDescription: incident.shortDescription || "",
      employeeNotes: incident.employeeNotes || "",
      policeReportFiled: !!incident.policeReportFiled,
      policeReportNumber: incident.policeReportNumber || "",
      medicalTreatmentRequired: !!incident.medicalTreatmentRequired,
      medicalTreatmentType: incident.medicalTreatmentType || "",
      witnesses: incident.witnesses || "",
      thirdPartyInvolvementType: incident.thirdPartyInvolvementType || "None",
      claimantName: incident.claimantName || "",
      claimNumber: incident.claimNumber || "",
      claimantLawyer: incident.claimantLawyer || "",
      supervisorNotes: incident.supervisorNotes || "",
      thirdPartyName: incident.thirdPartyName || "",
      thirdPartyPhone: incident.thirdPartyPhone || "",
      thirdPartyEmail: incident.thirdPartyEmail || "",
      withInsurance: !!incident.withInsurance,
      insurancePolicyId: incident.insurancePolicyId || "",
      paid: incident.paid ?? 0,
      reserved: incident.reserved ?? 0,
    });
    if (canManage && incident.incidentDate) {
      fetch(`/api/insurance/policies/lookup?date=${incident.incidentDate.split("T")[0]}`)
        .then((r) => r.json())
        .then((j) => setPolicyOptions(j.policies || []))
        .catch(() => setPolicyOptions([]));
    }
  };

  const refreshSelected = async (id: string) => {
    const res = await fetch(`/api/incidents/${id}`);
    const json = await res.json();
    if (res.ok) setSelected(json.incident);
  };

  const handleSaveDetail = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/incidents/${selected._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      notify.success("Incident updated");
      setSelected(null);
      load();
    } catch (err: any) {
      notify.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAddContactNote = async () => {
    if (!selected) return;
    if (!newContactNote.trim()) {
      notify.error("Enter a note before saving");
      return;
    }
    setAddingNote(true);
    try {
      const res = await fetch(`/api/incidents/${selected._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newContactNote: { method: newContactMethod, note: newContactNote.trim() } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add note");
      notify.success("Contact note added");
      setNewContactNote("");
      await refreshSelected(selected._id);
    } catch (err: any) {
      notify.error(err.message || "Failed to add note");
    } finally {
      setAddingNote(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm("Delete this incident? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/incidents/${selected._id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete");
      }
      notify.success("Incident deleted");
      setSelected(null);
      load();
    } catch (err: any) {
      notify.error(err.message || "Failed to delete");
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Incidents</h1>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Report Incident
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-0"><div className="text-2xl font-bold">{summary.total}</div><div className="text-xs text-muted-foreground">Total incidents</div></CardContent></Card>
        <Card><CardContent className="pt-0"><div className="text-2xl font-bold text-amber-600">{summary.open}</div><div className="text-xs text-muted-foreground">Open</div></CardContent></Card>
        <Card><CardContent className="pt-0"><div className="text-2xl font-bold text-emerald-600">{summary.closed}</div><div className="text-xs text-muted-foreground">Closed</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          <Button size="sm" variant={!showClosed ? "default" : "outline"} onClick={() => setShowClosed(false)}>Open only</Button>
          <Button size="sm" variant={showClosed ? "default" : "outline"} onClick={() => setShowClosed(true)}>All</Button>
        </div>
        {!canManage && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> Claim amounts, lawyer, insurance details, and contact notes are visible to HR/Admin only
          </span>
        )}
        <div className="ml-auto flex flex-col gap-1.5">
          <Label htmlFor="search">Search</Label>
          <Input id="search" placeholder="Employee, description, or type..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-64" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Employee</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              {canManage && <th className="px-3 py-2 text-left font-medium">Paid / Reserved</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={canManage ? 6 : 5} className="px-3 py-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={canManage ? 6 : 5} className="px-3 py-8 text-center text-muted-foreground">No incidents found.</td></tr>
            )}
            {filtered.map((i) => (
              <tr key={i._id} className="cursor-pointer border-t hover:bg-muted/30" onClick={() => openDetail(i)}>
                <td className="px-3 py-2">{i.incidentDate ? i.incidentDate.split("T")[0] : "—"}</td>
                <td className="px-3 py-2">{i.employeeName || i.transporterId}</td>
                <td className="px-3 py-2"><Badge variant="outline">{i.claimType || "—"}</Badge></td>
                <td className="max-w-xs truncate px-3 py-2">{i.shortDescription}</td>
                <td className="px-3 py-2">
                  <Badge className={STATUS_COLORS[i.claimStatus || "New"] || ""}>{i.claimStatus || "New"}</Badge>
                </td>
                {canManage && <td className="px-3 py-2">{money(i.paid)} / {money(i.reserved)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Quick create dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Report Incident</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Employee *</Label>
              <Select
                value={createForm.transporterId}
                onValueChange={(v) => {
                  const emp = employees.find((e) => e.transporterId === v);
                  setCreateForm({ ...createForm, transporterId: v, employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "" });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.transporterId} value={e.transporterId}>{e.firstName} {e.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Incident Date</Label>
                <Input type="date" value={createForm.incidentDate} onChange={(e) => setCreateForm({ ...createForm, incidentDate: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Type *</Label>
                <Select value={createForm.claimType} onValueChange={(v) => setCreateForm({ ...createForm, claimType: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {claimTypes.map((t) => <SelectItem key={t._id} value={t.description}>{t.description}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Van (optional)</Label>
              <Input value={createForm.van} onChange={(e) => setCreateForm({ ...createForm, van: e.target.value })} placeholder="VIN" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>What happened?</Label>
              <Textarea value={createForm.shortDescription} onChange={(e) => setCreateForm({ ...createForm, shortDescription: e.target.value })} rows={2} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Notes</Label>
              <Textarea value={createForm.employeeNotes} onChange={(e) => setCreateForm({ ...createForm, employeeNotes: e.target.value })} rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Switch checked={createForm.policeReportFiled} onCheckedChange={(v) => setCreateForm({ ...createForm, policeReportFiled: v })} />
                <Label>Police Report Filed</Label>
              </div>
              {createForm.policeReportFiled && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Report Number</Label>
                  <Input value={createForm.policeReportNumber} onChange={(e) => setCreateForm({ ...createForm, policeReportNumber: e.target.value })} />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={createForm.medicalTreatmentRequired} onCheckedChange={(v) => setCreateForm({ ...createForm, medicalTreatmentRequired: v })} />
                <Label>Medical Treatment Required</Label>
              </div>
              {createForm.medicalTreatmentRequired && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Treatment Type</Label>
                  <Select value={createForm.medicalTreatmentType} onValueChange={(v) => setCreateForm({ ...createForm, medicalTreatmentType: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {MEDICAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label className="text-xs">Third-Party Involvement</Label>
                <Select value={createForm.thirdPartyInvolvementType} onValueChange={(v) => setCreateForm({ ...createForm, thirdPartyInvolvementType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {THIRD_PARTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label className="text-xs">Witnesses (name & contact info, if any)</Label>
                <Textarea value={createForm.witnesses} onChange={(e) => setCreateForm({ ...createForm, witnesses: e.target.value })} rows={2} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Incident Report Form</Label>
              <Input type="file" multiple accept="image/*,.pdf" onChange={(e) => setReportFiles(e.target.files ? Array.from(e.target.files) : [])} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1"><Camera className="h-3.5 w-3.5" /> Photos</Label>
              <Input type="file" multiple accept="image/*" onChange={(e) => setPhotoFiles(e.target.files ? Array.from(e.target.files) : [])} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1"><FileIcon className="h-3.5 w-3.5" /> Other Files</Label>
              <Input type="file" multiple onChange={(e) => setOtherFiles(e.target.files ? Array.from(e.target.files) : [])} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Detail / edit dialog ── */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Incident — {selected?.employeeName || selected?.transporterId}</DialogTitle></DialogHeader>
          {selected && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><div className="text-muted-foreground">Incident Date</div><div>{selected.incidentDate?.split("T")[0]}</div></div>
                <div><div className="text-muted-foreground">Reported Date</div><div>{selected.reportedDate?.split("T")[0]}</div></div>
                <div><div className="text-muted-foreground">Type</div><div>{selected.claimType}</div></div>
                <div><div className="text-muted-foreground">Van</div><div>{selected.van || "—"}</div></div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select value={editForm.claimStatus} onValueChange={(v) => setEditForm({ ...editForm, claimStatus: v })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Close">Close</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>What happened?</Label>
                <Textarea value={editForm.shortDescription} onChange={(e) => setEditForm({ ...editForm, shortDescription: e.target.value })} rows={2} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Notes</Label>
                <Textarea value={editForm.employeeNotes} onChange={(e) => setEditForm({ ...editForm, employeeNotes: e.target.value })} rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Switch checked={editForm.policeReportFiled} onCheckedChange={(v) => setEditForm({ ...editForm, policeReportFiled: v })} />
                  <Label>Police Report Filed</Label>
                </div>
                {editForm.policeReportFiled && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Report Number</Label>
                    <Input value={editForm.policeReportNumber} onChange={(e) => setEditForm({ ...editForm, policeReportNumber: e.target.value })} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Switch checked={editForm.medicalTreatmentRequired} onCheckedChange={(v) => setEditForm({ ...editForm, medicalTreatmentRequired: v })} />
                  <Label>Medical Treatment Required</Label>
                </div>
                {editForm.medicalTreatmentRequired && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Treatment Type</Label>
                    <Select value={editForm.medicalTreatmentType} onValueChange={(v) => setEditForm({ ...editForm, medicalTreatmentType: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {MEDICAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label className="text-xs">Third-Party Involvement</Label>
                  <Select value={editForm.thirdPartyInvolvementType} onValueChange={(v) => setEditForm({ ...editForm, thirdPartyInvolvementType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {THIRD_PARTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label className="text-xs">Witnesses</Label>
                  <Textarea value={editForm.witnesses} onChange={(e) => setEditForm({ ...editForm, witnesses: e.target.value })} rows={2} />
                </div>
              </div>

              {selected.attachments && selected.attachments.length > 0 && (
                <div className="flex flex-col gap-2">
                  <Label>Attachments</Label>
                  {ATTACHMENT_CATEGORIES.map(({ key, label, icon: Icon }) => {
                    const files = (selected.attachments || []).filter((a) => a.category === key);
                    if (files.length === 0) return null;
                    return (
                      <div key={key} className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <div className="flex flex-wrap gap-2">
                          {files.map((a, i) => (
                            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:underline">
                              <Icon className="h-3 w-3" /> {a.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {canManage && (
                <div className="flex flex-col gap-4 rounded-md border p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">Claim & Insurance (HR/Admin only)</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label>Claimant Name</Label>
                      <Input value={editForm.claimantName} onChange={(e) => setEditForm({ ...editForm, claimantName: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Claim Number</Label>
                      <Input value={editForm.claimNumber} onChange={(e) => setEditForm({ ...editForm, claimNumber: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Claimant Lawyer</Label>
                      <Input value={editForm.claimantLawyer} onChange={(e) => setEditForm({ ...editForm, claimantLawyer: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <Switch checked={editForm.withInsurance} onCheckedChange={(v) => setEditForm({ ...editForm, withInsurance: v })} />
                      <Label>With Insurance</Label>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Paid ($)</Label>
                      <Input type="number" value={editForm.paid} onChange={(e) => setEditForm({ ...editForm, paid: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Reserved ($)</Label>
                      <Input type="number" value={editForm.reserved} onChange={(e) => setEditForm({ ...editForm, reserved: e.target.value })} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Insurance Policy</Label>
                    <Select value={editForm.insurancePolicyId || "none"} onValueChange={(v) => setEditForm({ ...editForm, insurancePolicyId: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="No policy linked" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No policy linked</SelectItem>
                        {policyOptions.map((p) => (
                          <SelectItem key={p._id} value={p._id}>
                            {p.policyNumber} — {p.company} ({p.type}){p.coversDate ? " ✓ covers this date" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label>Third Party Name</Label>
                      <Input value={editForm.thirdPartyName} onChange={(e) => setEditForm({ ...editForm, thirdPartyName: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Third Party Phone</Label>
                      <Input value={editForm.thirdPartyPhone} onChange={(e) => setEditForm({ ...editForm, thirdPartyPhone: e.target.value })} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Supervisor Notes</Label>
                    <Textarea value={editForm.supervisorNotes} onChange={(e) => setEditForm({ ...editForm, supervisorNotes: e.target.value })} rows={2} />
                  </div>

                  <div className="flex flex-col gap-2 border-t pt-3">
                    <Label className="flex items-center gap-1"><PhoneCall className="h-3.5 w-3.5" /> Contact Log</Label>
                    <p className="text-xs text-muted-foreground">A running record of check-ins — e.g. calling the employee to ask how they're doing.</p>
                    {selected.contactLog && selected.contactLog.length > 0 && (
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                        {[...selected.contactLog].reverse().map((c, i) => (
                          <div key={i} className="rounded-md bg-muted/50 p-2 text-sm">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{c.method} • {c.contactedBy}</span>
                              <span>{new Date(c.date).toLocaleString()}</span>
                            </div>
                            <div className="mt-1">{c.note}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Select value={newContactMethod} onValueChange={setNewContactMethod}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONTACT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="e.g. Called to check on his condition, said he's doing fine"
                        value={newContactNote}
                        onChange={(e) => setNewContactNote(e.target.value)}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={handleAddContactNote} disabled={addingNote}>
                        {addingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                {canManage ? (
                  <Button variant="outline" className="text-destructive" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                ) : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                  <Button onClick={handleSaveDetail} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
