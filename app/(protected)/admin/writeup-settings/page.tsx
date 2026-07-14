"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { Loader2, Save, Settings, Plus, X, Layers, FileEdit, Trash2 } from "lucide-react";

interface CategoryOption { _id: string; description: string; isActive?: boolean }
interface CorrectiveActionTemplate { categoryLabel: string; subCategory?: string; planForImprovement: string; consequences?: string }

const THRESHOLD_KEYS = [
  { key: "second_warning", label: "Second Warning at" },
  { key: "third_warning", label: "Third Warning at" },
  { key: "final_warning", label: "Final Warning at" },
  { key: "suspension_review", label: "Suspension Review at" },
];

export default function WriteupSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lookbackDays, setLookbackDays] = useState(90);
  const [thresholds, setThresholds] = useState<Record<string, number>>({
    second_warning: 1, third_warning: 2, final_warning: 3, suspension_review: 4,
  });
  const [stackGroups, setStackGroups] = useState<string[][]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [addToGroup, setAddToGroup] = useState<Record<number, string>>({});
  const [templates, setTemplates] = useState<CorrectiveActionTemplate[]>([]);
  const [defaultConsequences, setDefaultConsequences] = useState("");
  const [defaultTemplates, setDefaultTemplates] = useState<CorrectiveActionTemplate[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/writeup-settings");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load settings");
      setLookbackDays(json.settings.lookbackDays ?? 90);
      setThresholds(json.settings.escalationThresholds || thresholds);
      setStackGroups(json.settings.stackGroups || []);
      setCategories(json.categories || []);
      setTemplates(json.settings.correctiveActionTemplates || []);
      setDefaultConsequences(json.settings.defaultConsequences || "");
      setDefaultTemplates(json.defaultTemplates || []);
    } catch (err: any) {
      notify.error(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/writeup-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lookbackDays,
          escalationThresholds: thresholds,
          stackGroups: stackGroups.filter((g) => g.length > 1),
          correctiveActionTemplates: templates,
          defaultConsequences,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save settings");
      notify.success("Write-up settings saved");
      setStackGroups(json.settings.stackGroups || []);
      setTemplates(json.settings.correctiveActionTemplates || []);
      setDefaultConsequences(json.settings.defaultConsequences || "");
    } catch (err: any) {
      notify.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const categoriesInAnyGroup = new Set(stackGroups.flat());

  const addGroup = () => setStackGroups([...stackGroups, []]);
  const removeGroup = (idx: number) => setStackGroups(stackGroups.filter((_, i) => i !== idx));
  const addCategoryToGroup = (idx: number) => {
    const cat = addToGroup[idx];
    if (!cat) return;
    setStackGroups(stackGroups.map((g, i) => (i === idx ? [...g, cat] : g)));
    setAddToGroup({ ...addToGroup, [idx]: "" });
  };
  const removeCategoryFromGroup = (idx: number, cat: string) => {
    setStackGroups(stackGroups.map((g, i) => (i === idx ? g.filter((c) => c !== cat) : g)));
  };

  const normalize = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  // Only count a category as "has a template" for the add-chip list when
  // it has a blank-subCategory / general template — categories that only
  // have sub-reason-specific templates (e.g. Safety Infraction split into
  // Seatbelt / Speeding / etc.) still show up so a general fallback can
  // be added too.
  const categoriesWithGeneralTemplate = new Set(
    templates.filter((t) => !t.subCategory?.trim()).map((t) => normalize(t.categoryLabel))
  );
  const realCategoryNames = new Set(categories.map((c) => c.description.toLowerCase()));

  // Adding a template is immediate — click a category chip and it's added,
  // pre-filled with the seeded default plan for this category (if one
  // exists) and the current Default Consequences as a starting override,
  // so there's no blank-page problem. Still fully editable before saving.
  const addTemplate = (categoryLabel: string) => {
    if (categoriesWithGeneralTemplate.has(normalize(categoryLabel))) return;
    const seeded = defaultTemplates.find(
      (t) => normalize(t.categoryLabel) === normalize(categoryLabel) && !t.subCategory?.trim()
    );
    setTemplates([
      ...templates,
      {
        categoryLabel,
        planForImprovement: seeded?.planForImprovement || "",
        consequences: seeded?.consequences || defaultConsequences || "",
      },
    ]);
  };
  // Adds another template under the same category with a blank sub-reason
  // — for categories that need more than one corrective-action text (e.g.
  // "Safety Infraction" split into Seatbelt / Speeding / Distraction /
  // Following Distance / Sign-Signal). The manager fills in the specific
  // sub-reason and its text. When a category has 2+ sub-reason templates,
  // the New Write-Up form shows a picker so the right one auto-fills.
  const addSubReason = (categoryLabel: string) => {
    setTemplates([
      ...templates,
      { categoryLabel, subCategory: "", planForImprovement: "", consequences: defaultConsequences || "" },
    ]);
  };
  const updateTemplate = (idx: number, field: "planForImprovement" | "consequences" | "subCategory", value: string) => {
    setTemplates(templates.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };
  const updateTemplateCategory = (idx: number, categoryLabel: string) => {
    setTemplates(templates.map((t, i) => (i === idx ? { ...t, categoryLabel } : t)));
  };
  const removeTemplate = (idx: number) => setTemplates(templates.filter((_, i) => i !== idx));

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Write-Up Settings</h1>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="text-sm font-medium">Escalation Ladder</div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Lookback Window (days)</Label>
            <p className="text-xs text-muted-foreground">Only counts prior write-ups within this many days when recommending a warning level.</p>
            <Select value={String(lookbackDays)} onValueChange={(v) => setLookbackDays(Number(v))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[30, 60, 90, 180, 365].map((d) => <SelectItem key={d} value={String(d)}>{d} days</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {THRESHOLD_KEYS.map((t) => (
              <div key={t.key} className="flex flex-col gap-1.5">
                <Label className="text-xs">{t.label} this many priors</Label>
                <Input
                  type="number"
                  min={0}
                  value={thresholds[t.key]}
                  onChange={(e) => setThresholds({ ...thresholds, [t.key]: Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Example with defaults: 0 priors → First Warning, 1 prior → Second Warning, 2 → Third, 3 → Final, 4+ → Suspension Review.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium"><Layers className="h-4 w-4" /> Category Stack Groups</div>
              <p className="text-xs text-muted-foreground">Categories in the same group share one escalation count (e.g. Seatbelt-off Rate + Violation of Safety Rules count toward the same ladder). Categories not in any group stack only with themselves.</p>
            </div>
            <Button size="sm" variant="outline" onClick={addGroup}><Plus className="h-3.5 w-3.5" /> Add Group</Button>
          </div>

          {stackGroups.length === 0 && <p className="text-sm text-muted-foreground">No stack groups configured yet — every category tracks its own count.</p>}

          {stackGroups.map((group, idx) => (
            <div key={idx} className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase text-muted-foreground">Group {idx + 1}</span>
                <Button size="sm" variant="ghost" className="h-6 text-destructive" onClick={() => removeGroup(idx)}>Remove group</Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.map((cat) => (
                  <Badge key={cat} variant="secondary" className="gap-1">
                    {cat}
                    <button onClick={() => removeCategoryFromGroup(idx, cat)}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Select value={addToGroup[idx] || ""} onValueChange={(v) => setAddToGroup({ ...addToGroup, [idx]: v })}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Add a category to this group" /></SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((c) => !group.includes(c.description))
                      .map((c) => (
                        <SelectItem key={c._id} value={c.description}>
                          {c.description}
                          {categoriesInAnyGroup.has(c.description) && !group.includes(c.description) ? " (in another group)" : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => addCategoryToGroup(idx)}>Add</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium"><FileEdit className="h-4 w-4" /> Corrective Action Templates</div>
            <p className="text-xs text-muted-foreground">
              Auto-fills the Plan for Improvement and Consequences fields on the New Write-Up form when a category is selected —
              managers can still edit before saving. Categories without a template here just start blank. The category on each
              template below must exactly match a real category from your dropdown list, or auto-fill won't trigger for it. A
              category can have more than one template if you give each a distinct sub-reason (e.g. "Safety Infraction" split
              into Seatbelt / Speeding / etc.) — the New Write-Up form will then ask which specific issue applies.
            </p>
          </div>

          {templates.length === 0 && <p className="text-sm text-muted-foreground">No templates configured yet.</p>}

          {templates.map((t, idx) => {
            const isOrphaned = !realCategoryNames.has(t.categoryLabel.toLowerCase());
            return (
            <div key={idx} className={cn("flex flex-col gap-2 rounded-md border p-3", isOrphaned && "border-amber-300 bg-amber-50/40 dark:bg-amber-950/10")}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-1 items-center gap-2">
                  <Select value={t.categoryLabel} onValueChange={(v) => updateTemplateCategory(idx, v)}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {isOrphaned && <SelectItem value={t.categoryLabel}>{t.categoryLabel} (not a real category)</SelectItem>}
                      {categories.map((c) => <SelectItem key={c._id} value={c.description}>{c.description}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    value={t.subCategory || ""}
                    onChange={(e) => updateTemplate(idx, "subCategory", e.target.value)}
                    placeholder="Sub-reason (optional, e.g. Seatbelt)"
                    className="flex-1"
                  />
                </div>
                <Button size="sm" variant="ghost" className="h-6 text-destructive" onClick={() => removeTemplate(idx)}>
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              </div>
              {isOrphaned && (
                <p className="text-xs text-amber-800 dark:text-amber-400">
                  "{t.categoryLabel}" doesn't match any category in your dropdown list, so this template won't auto-fill for anything. Pick the real category above.
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Plan for Improvement</Label>
                <Textarea
                  value={t.planForImprovement}
                  onChange={(e) => updateTemplate(idx, "planForImprovement", e.target.value)}
                  rows={3}
                  placeholder="Expected behavior / corrective steps for this category..."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Consequences override (optional — otherwise the default below is used)</Label>
                <Textarea
                  value={t.consequences || ""}
                  onChange={(e) => updateTemplate(idx, "consequences", e.target.value)}
                  rows={2}
                  placeholder="e.g. tiered violation consequences specific to this category..."
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-fit text-xs text-muted-foreground"
                onClick={() => addSubReason(t.categoryLabel)}
              >
                <Plus className="h-3 w-3" /> Add another sub-reason for {t.categoryLabel || "this category"}
              </Button>
            </div>
            );
          })}

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Add a template for a category</Label>
            <p className="text-xs text-muted-foreground">Click a category to add it — pre-filled with the default plan for improvement and consequences where available, ready to edit.</p>
            <div className="flex flex-wrap gap-1.5">
              {categories.filter((c) => !categoriesWithGeneralTemplate.has(normalize(c.description))).length === 0 && (
                <p className="text-sm text-muted-foreground">Every category already has a template.</p>
              )}
              {categories
                .filter((c) => !categoriesWithGeneralTemplate.has(normalize(c.description)))
                .map((c) => {
                  const hasDefault = defaultTemplates.some(
                    (t) => normalize(t.categoryLabel) === normalize(c.description) && !t.subCategory?.trim()
                  );
                  const hasSubReasonDefaults = defaultTemplates.some(
                    (t) => normalize(t.categoryLabel) === normalize(c.description) && !!t.subCategory?.trim()
                  );
                  return (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => addTemplate(c.description)}
                      className="inline-flex items-center gap-1 rounded-full border border-input px-2.5 py-1 text-xs transition-colors hover:border-primary hover:bg-primary/5"
                    >
                      <Plus className="h-3 w-3" /> {c.description}
                      {hasDefault && <span className="text-muted-foreground">(default available)</span>}
                      {!hasDefault && hasSubReasonDefaults && (
                        <span className="text-muted-foreground">(has sub-reason defaults — see rows above)</span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 border-t pt-4">
            <Label className="text-xs">Default Consequences</Label>
            <p className="text-xs text-muted-foreground">Used for any category without a consequences override above.</p>
            <Textarea value={defaultConsequences} onChange={(e) => setDefaultConsequences(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
