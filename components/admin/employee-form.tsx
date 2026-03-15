
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/admin/image-upload";
import { FileUpload } from "@/components/admin/file-upload";
import { ISymxEmployee } from "@/lib/models/SymxEmployee";
import {
  Loader2,
  User,
  Briefcase,
  Truck,
  FileText,
  LogOut,
} from "lucide-react";
import { formatPhoneNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

type FormEmployee = Omit<Partial<ISymxEmployee>, '_id'> & { _id?: string };

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
  { key: "logistics", label: "Logistics & Schedule", icon: Truck },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "offboarding", label: "Offboarding", icon: LogOut },
] as const;

type TabKey = typeof TABS[number]["key"];

export function EmployeeForm({ initialData, onSubmit, isLoading, onCancel }: EmployeeFormProps) {
  const [formData, setFormData] = useState<FormEmployee>(initialData || {
    status: 'Active',
    sunday: 'OFF',
    monday: 'OFF',
    tuesday: 'OFF',
    wednesday: 'OFF',
    thursday: 'OFF',
    friday: 'OFF',
    saturday: 'OFF',
    finalCheckIssued: false,
    paycomOffboarded: false,
    amazonOffboarded: false,
    eligibility: false,
  });

  const [activeTab, setActiveTab] = useState<TabKey>("personal");
  const [routeTypes, setRouteTypes] = useState<string[]>([]);

  // Fetch route types for day dropdowns
  useEffect(() => {
    fetch("/api/admin/settings/route-types")
      .then(r => r.json())
      .then((types: any[]) => {
        if (Array.isArray(types)) setRouteTypes(types.map(t => t.name));
      })
      .catch(() => {});
  }, []);

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
                <Label htmlFor="eeCode">EE Code</Label>
                <Input id="eeCode" value={formData.eeCode || ""} onChange={(e) => handleChange("eeCode", e.target.value)} />
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={formData.gender || ""} onValueChange={(val) => handleChange("gender", val)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
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
                  <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Employee">Employee</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="Planning">Planning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status || ""} onValueChange={(val) => handleChange("status", val)}>
                  <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Terminated">Terminated</SelectItem>
                    <SelectItem value="Resigned">Resigned</SelectItem>
                  </SelectContent>
                </Select>
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
                <Label htmlFor="rate">Rate ($)</Label>
                <Input type="number" id="rate" value={formData.rate || ""} onChange={(e) => handleChange("rate", parseFloat(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="routesComp">Routes Comp</Label>
                <Input id="routesComp" value={formData.routesComp || ""} onChange={(e) => handleChange("routesComp", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* LOGISTICS TAB */}
        {activeTab === "logistics" && (
          <div className="space-y-5 animate-in fade-in-0 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label className="text-base font-semibold">Weekly Availability</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((day) => (
                    <div key={day} className="flex flex-col gap-1.5 p-3 rounded-xl bg-muted/10 border">
                      <Label htmlFor={day} className="capitalize text-[10px] font-bold text-muted-foreground">{day}</Label>
                      <Select
                        value={String(formData[day as keyof ISymxEmployee] || 'OFF')}
                        onValueChange={(val) => handleChange(day as keyof ISymxEmployee, val)}
                      >
                        <SelectTrigger id={day} className="h-9 font-medium">
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {routeTypes.map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                          {!routeTypes.includes("OFF") && (
                            <SelectItem value="OFF">OFF</SelectItem>
                          )}
                          {!routeTypes.includes("Assign Schedule") && (
                            <SelectItem value="Assign Schedule">Assign Schedule</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gasCardPin">Gas Card PIN</Label>
                  <Input id="gasCardPin" value={formData.gasCardPin || ""} onChange={(e) => handleChange("gasCardPin", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dlExpiration">DL Expiration</Label>
                  <Input type="date" id="dlExpiration" value={formatDate(formData.dlExpiration)} onChange={(e) => handleDateChange("dlExpiration", e)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="motorVehicleReportDate">Motor Vehicle Report Date</Label>
                  <Input type="date" id="motorVehicleReportDate" value={formatDate(formData.motorVehicleReportDate)} onChange={(e) => handleDateChange("motorVehicleReportDate", e)} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="defaultVan1">Default Van 1</Label>
                <Input id="defaultVan1" value={formData.defaultVan1 || ""} onChange={(e) => handleChange("defaultVan1", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultVan2">Default Van 2</Label>
                <Input id="defaultVan2" value={formData.defaultVan2 || ""} onChange={(e) => handleChange("defaultVan2", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultVan3">Default Van 3</Label>
                <Input id="defaultVan3" value={formData.defaultVan3 || ""} onChange={(e) => handleChange("defaultVan3", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ScheduleNotes">Schedule Notes</Label>
              <Textarea id="ScheduleNotes" value={formData.ScheduleNotes || ""} onChange={(e) => handleChange("ScheduleNotes", e.target.value)} />
            </div>
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === "documents" && (
          <div className="space-y-5 animate-in fade-in-0 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label>Offer Letter</Label>
                <FileUpload
                  value={formData.offerLetterFile || ""}
                  onChange={(url) => handleChange("offerLetterFile", url)}
                  accept=".pdf,.doc,.docx"
                  label="Upload Offer Letter"
                />
              </div>
              <div className="space-y-4">
                <Label>Handbook Acknowledgement</Label>
                <FileUpload
                  value={formData.handbookFile || ""}
                  onChange={(url) => handleChange("handbookFile", url)}
                  accept=".pdf,.doc,.docx"
                  label="Upload Handbook"
                />
              </div>
              <div className="space-y-4">
                <Label>Driver&apos;s License</Label>
                <FileUpload
                  value={formData.driversLicenseFile || ""}
                  onChange={(url) => handleChange("driversLicenseFile", url)}
                  accept=".pdf,image/*"
                  label="Upload License"
                />
              </div>
              <div className="space-y-4">
                <Label>I-9 Form</Label>
                <FileUpload
                  value={formData.i9File || ""}
                  onChange={(url) => handleChange("i9File", url)}
                  accept=".pdf"
                  label="Upload I-9"
                />
              </div>
              <div className="space-y-4">
                <Label>Drug Test Results</Label>
                <FileUpload
                  value={formData.drugTestFile || ""}
                  onChange={(url) => handleChange("drugTestFile", url)}
                  accept=".pdf"
                  label="Upload Drug Test"
                />
              </div>
            </div>
          </div>
        )}

        {/* OFFBOARDING TAB */}
        {activeTab === "offboarding" && (
          <div className="space-y-5 animate-in fade-in-0 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Termination */}
              <div className="space-y-4 border p-4 rounded-xl bg-muted/5">
                <h3 className="font-semibold text-sm">Termination</h3>
                <div className="space-y-2">
                  <Label htmlFor="terminationDate">Termination Date</Label>
                  <Input type="date" id="terminationDate" value={formatDate(formData.terminationDate)} onChange={(e) => handleDateChange("terminationDate", e)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="terminationReason">Reason</Label>
                  <Input id="terminationReason" value={formData.terminationReason || ""} onChange={(e) => handleChange("terminationReason", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Termination Letter</Label>
                  <FileUpload
                    value={formData.terminationLetter || ""}
                    onChange={(url) => handleChange("terminationLetter", url)}
                    accept=".pdf,.doc,.docx"
                  />
                </div>
              </div>

              {/* Resignation */}
              <div className="space-y-4 border p-4 rounded-xl bg-muted/5">
                <h3 className="font-semibold text-sm">Resignation</h3>
                <div className="space-y-2">
                  <Label htmlFor="resignationDate">Resignation Date</Label>
                  <Input type="date" id="resignationDate" value={formatDate(formData.resignationDate)} onChange={(e) => handleDateChange("resignationDate", e)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resignationType">Type</Label>
                  <Select value={formData.resignationType || ""} onValueChange={(val) => handleChange("resignationType", val)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Voluntary">Voluntary</SelectItem>
                      <SelectItem value="Involuntary">Involuntary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Resignation Letter</Label>
                  <FileUpload
                    value={formData.resignationLetter || ""}
                    onChange={(url) => handleChange("resignationLetter", url)}
                    accept=".pdf,.doc,.docx"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eligibility">Rehire Eligibility</Label>
                <div className="flex items-center space-x-2 mt-2">
                  <Checkbox
                    id="eligibility"
                    checked={!!formData.eligibility}
                    onCheckedChange={(checked) => handleChange("eligibility", checked)}
                  />
                  <Label htmlFor="eligibility">Eligible for Rehire</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastDateWorked">Last Date Worked</Label>
                <Input type="date" id="lastDateWorked" value={formatDate(formData.lastDateWorked)} onChange={(e) => handleDateChange("lastDateWorked", e)} />
              </div>
              <div className="space-y-2">
                <Label>Final Check</Label>
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="finalCheckIssued"
                      checked={formData.finalCheckIssued || false}
                      onCheckedChange={(checked) => handleChange("finalCheckIssued", checked)}
                    />
                    <Label htmlFor="finalCheckIssued">Issued</Label>
                  </div>
                  <div className="space-y-2 mt-2">
                    <Label>Final Check Attachment</Label>
                    <FileUpload
                      value={formData.finalCheck || ""}
                      onChange={(url) => handleChange("finalCheck", url)}
                      accept=".pdf,image/*"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2 border p-3 rounded-xl">
                <Checkbox id="paycomOffboarded" checked={formData.paycomOffboarded || false} onCheckedChange={(c) => handleChange("paycomOffboarded", c)} />
                <Label htmlFor="paycomOffboarded">Paycom Offboarded</Label>
              </div>
              <div className="flex items-center space-x-2 border p-3 rounded-xl">
                <Checkbox id="amazonOffboarded" checked={formData.amazonOffboarded || false} onCheckedChange={(c) => handleChange("amazonOffboarded", c)} />
                <Label htmlFor="amazonOffboarded">Amazon Offboarded</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exitInterviewNotes">Exit Interview Notes</Label>
              <Textarea id="exitInterviewNotes" value={formData.exitInterviewNotes || ""} onChange={(e) => handleChange("exitInterviewNotes", e.target.value)} />
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
