
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/admin/image-upload";
import { FileUpload } from "@/components/admin/file-upload";
import { ISymxEmployee } from "@/lib/models/SymxEmployee";
import { Loader2 } from "lucide-react";

type FormEmployee = Omit<Partial<ISymxEmployee>, '_id'> & { _id?: string };

interface EmployeeFormProps {
  initialData?: FormEmployee;
  onSubmit: (data: FormEmployee) => Promise<void>;
  isLoading: boolean;
  onCancel: () => void;
}

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

  const handleChange = (field: keyof FormEmployee, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (field: keyof FormEmployee, e: React.ChangeEvent<HTMLInputElement>) => {
    // Input date returns string yyyy-mm-dd
    const date = e.target.value ? new Date(e.target.value) : undefined;
    setFormData(prev => ({ ...prev, [field]: date }));
  };

  // Helper to format date for input value (yyyy-mm-dd)
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="logistics">Logistics & Schedule</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="offboarding">Offboarding</TabsTrigger>
        </TabsList>

        <div className="mt-6 space-y-4">
          {/* PERSONAL TAB */}
          <TabsContent value="personal" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    onChange={(e) => handleChange("phoneNumber", e.target.value)} 
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

              <div className="space-y-4">
                <Label>Profile Image</Label>
                <div className="border rounded-lg p-4 bg-muted/10 h-[300px]">
                   <ImageUpload 
                      value={formData.profileImage || ""} 
                      onChange={(url) => handleChange("profileImage", url)}
                      compact={false}
                   />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* EMPLOYMENT TAB */}
          <TabsContent value="employment" className="space-y-4">
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
                  <Select value={formData.gender} onValueChange={(val) => handleChange("gender", val)}>
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
                  <Select value={formData.type} onValueChange={(val) => handleChange("type", val)}>
                    <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full-Time">Full-Time</SelectItem>
                      <SelectItem value="Part-Time">Part-Time</SelectItem>
                      <SelectItem value="Contractor">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(val) => handleChange("status", val)}>
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
                  <Input id="hourlyStatus" value={formData.hourlyStatus || ""} onChange={(e) => handleChange("hourlyStatus", e.target.value)} />
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
          </TabsContent>

          {/* LOGISTICS TAB */}
          <TabsContent value="logistics" className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-4">
                  <Label className="text-base font-semibold">Weekly Availability</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            <SelectItem value="Route">Route</SelectItem>
                            <SelectItem value="Assign Schedule">Assign Schedule</SelectItem>
                            <SelectItem value="OFF">OFF</SelectItem>
                            <SelectItem value="Open">Open</SelectItem>
                            <SelectItem value="Close">Close</SelectItem>
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
          </TabsContent>

          {/* DOCUMENTS TAB */}
          <TabsContent value="documents" className="space-y-4">
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
                 <Label>Driver's License</Label>
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
          </TabsContent>

          {/* OFFBOARDING TAB */}
          <TabsContent value="offboarding" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Termination */}
                 <div className="space-y-4 border p-4 rounded-md">
                    <h3 className="font-semibold">Termination</h3>
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
                 <div className="space-y-4 border p-4 rounded-md">
                    <h3 className="font-semibold">Resignation</h3>
                    <div className="space-y-2">
                      <Label htmlFor="resignationDate">Resignation Date</Label>
                      <Input type="date" id="resignationDate" value={formatDate(formData.resignationDate)} onChange={(e) => handleDateChange("resignationDate", e)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="resignationType">Type</Label>
                      <Select value={formData.resignationType} onValueChange={(val) => handleChange("resignationType", val)}>
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
                 <div className="flex items-center space-x-2 border p-3 rounded-md">
                    <Checkbox id="paycomOffboarded" checked={formData.paycomOffboarded || false} onCheckedChange={(c) => handleChange("paycomOffboarded", c)} />
                    <Label htmlFor="paycomOffboarded">Paycom Offboarded</Label>
                 </div>
                 <div className="flex items-center space-x-2 border p-3 rounded-md">
                    <Checkbox id="amazonOffboarded" checked={formData.amazonOffboarded || false} onCheckedChange={(c) => handleChange("amazonOffboarded", c)} />
                    <Label htmlFor="amazonOffboarded">Amazon Offboarded</Label>
                 </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exitInterviewNotes">Exit Interview Notes</Label>
                <Textarea id="exitInterviewNotes" value={formData.exitInterviewNotes || ""} onChange={(e) => handleChange("exitInterviewNotes", e.target.value)} />
              </div>
          </TabsContent>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Employee
          </Button>
        </div>
      </Tabs>
    </form>
  );
}
