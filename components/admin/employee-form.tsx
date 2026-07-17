
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ImageUpload } from "@/components/admin/image-upload";
import { ISymxEmployee } from "@/lib/models/SymxEmployee";
import {
  Loader2,
  User,
  Briefcase,
  Lock,
} from "lucide-react";
import { formatPhoneNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

type FormEmployee = Omit<Partial<ISymxEmployee>, '_id' | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'> & {
  _id?: string;
  sunday?: string;
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
};

interface EmployeeFormProps {
  initialData?: FormEmployee;
  onSubmit: (data: FormEmployee) => Promise<void>;
  isLoading: boolean;
  onCancel: () => void;
}

// ── Tab definitions ──
const TABS = [
  { key: "personal", label: "Personal", icon: User },
  { key: "employment", label: "Employment", icon: Briefcase },
] as const;

type TabKey = typeof TABS[number]["key"];

export function EmployeeForm({ initialData, onSubmit, isLoading, onCancel }: EmployeeFormProps) {
  const [formData, setFormData] = useState<FormEmployee>(initialData || {
    status: 'Active',
    sunday: '69f8d51a4e04c9a132a586cf',
    monday: '69f8d51a4e04c9a132a586cf',
    tuesday: '69f8d51a4e04c9a132a586cf',
    wednesday: '69f8d51a4e04c9a132a586cf',
    thursday: '69f8d51a4e04c9a132a586cf',
    friday: '69f8d51a4e04c9a132a586cf',
    saturday: '69f8d51a4e04c9a132a586cf',
    finalCheckIssued: false,
    paycomOffboarded: false,
    amazonOffboarded: false,
    eligibility: false,
  });

  const [activeTab, setActiveTab] = useState<TabKey>("personal");

  // Editing an existing employee whose `rate` came back stripped by the API means the
  // current viewer doesn't have compensation-view permission (see
  // lib/compensation-visibility.ts) — every real employee record has a rate, so a missing
  // one here means "hidden," not "unset." Show the field as locked instead of a blank
  // required input the viewer would be forced to fill in (and could accidentally overwrite
  // the real rate with) just to save any other edit.
  const isRateMasked = !!initialData?._id && initialData?.rate === undefined;


  const handleChange = (field: keyof FormEmployee, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (field: keyof FormEmployee, e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : undefined;
    setFormData(prev => ({ ...prev, [field]: date }));
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split('T')[0];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* ── Tab Navigation ── */}
      <div className="shrink-0 mb-5">
        <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-muted/50 border border-border/50">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 select-none",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 min-h-0">
        {/* PERSONAL TAB */}
        {activeTab === "personal" && (
          <div className="space-y-5 animate-in fade-in-0 duration-200">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      required
                      value={formData.firstName || ""}
                      onChange={(e) => handleChange("firstName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      required
                      value={formData.lastName || ""}
                      onChange={(e) => handleChange("lastName", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email || ""}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    value={formData.phoneNumber || ""}
                    onChange={(e) => handleChange("phoneNumber", formatPhoneNumber(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="streetAddress">Street Address</Label>
                  <Input
                    id="streetAddress"
                    value={formData.streetAddress || ""}
                    onChange={(e) => handleChange("streetAddress", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city || ""}
                      onChange={(e) => handleChange("city", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state || ""}
                      onChange={(e) => handleChange("state", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">Zip Code</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode || ""}
                      onChange={(e) => handleChange("zipCode", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Profile Image</Label>
                <div className="border rounded-xl p-3 bg-muted/10 h-[280px]">
                  <ImageUpload
                    value={formData.profileImage || ""}
                    onChange={(url) => handleChange("profileImage", url)}
                    compact={false}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EMPLOYMENT TAB */}
        {activeTab === "employment" && (
          <div className="space-y-5 animate-in fade-in-0 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eeCode">EE Code *</Label>
                <Input id="eeCode" required value={formData.eeCode || ""} onChange={(e) => handleChange("eeCode", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transporterId">Transporter ID</Label>
                <Input id="transporterId" value={formData.transporterId || ""} onChange={(e) => handleChange("transporterId", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="badgeNumber">Badge Number</Label>
                <Input id="badgeNumber" value={formData.badgeNumber || ""} onChange={(e) => handleChange("badgeNumber", e.target.value)} />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground -mt-1">
              2nd meal period waiver (CA) is now uploaded as a document from HR &gt; Employee Audit, not toggled here.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={formData.gender || ""} onValueChange={(val) => handleChange("gender", val)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={formData.type || ""} onValueChange={(val) => handleChange("type", val)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Employee">Employee</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="Planning">Planning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="routesComp">Routes Comp</Label>
                <Input id="routesComp" value={formData.routesComp || ""} onChange={(e) => handleChange("routesComp", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hiredDate">Hired Date</Label>
                <Input type="date" id="hiredDate" value={formatDate(formData.hiredDate)} onChange={(e) => handleDateChange("hiredDate", e)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input type="date" id="dob" value={formatDate(formData.dob)} onChange={(e) => handleDateChange("dob", e)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hourlyStatus">Hourly Status</Label>
                <Select value={formData.hourlyStatus || ""} onValueChange={(val) => handleChange("hourlyStatus", val)}>
                  <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full Time">Full Time</SelectItem>
                    <SelectItem value="Seasonal">Seasonal</SelectItem>
                    <SelectItem value="Part Time">Part Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate">Rate ($) *</Label>
                {isRateMasked ? (
                  <div className="flex h-9 items-center gap-1.5 rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground italic">
                    <Lock className="w-3.5 h-3.5" /> No permission to view or edit
                  </div>
                ) : (
                  <Input type="number" id="rate" required min="0" step="0.01" value={formData.rate ?? ""} onChange={(e) => handleChange("rate", e.target.value === "" ? undefined : parseFloat(e.target.value))} />
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 flex justify-end gap-2 mt-6 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Employee
        </Button>
      </div>
    </form>
  );
}
