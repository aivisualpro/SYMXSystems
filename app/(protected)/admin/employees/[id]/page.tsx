"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Clock, 
  DollarSign, 
  Briefcase, 
  FileText, 
  ShieldCheck, 
  AlertTriangle,
  ChevronLeft,
  Pencil,
  CheckCircle2,
  XCircle,
  Truck,
  IdCard,
  Building2,
  CalendarCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ISymxEmployee } from "@/lib/models/SymxEmployee";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { EmployeeForm } from "@/components/admin/employee-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function EmployeeDetailPage(props: PageProps) {
  const params = use(props.params);
  const router = useRouter();
  const [employee, setEmployee] = useState<ISymxEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { setLeftContent, setRightContent } = useHeaderActions();

  useEffect(() => {
    if (employee) {
      setLeftContent(
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          {employee.firstName} {employee.lastName}
        </h1>
      );

      setRightContent(
        <Button 
          size="sm"
          className="rounded-lg shadow-md shadow-primary/20 h-8 px-3"
          onClick={() => setIsEditDialogOpen(true)}
        >
          <Pencil className="w-4 h-4 mr-2" /> Edit
        </Button>
      );
    }

    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [employee, setLeftContent, setRightContent]);

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const response = await fetch(`/api/admin/employees/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setEmployee(data);
        } else {
          toast.error("Employee not found");
          router.push("/admin/employees");
        }
      } catch (error) {
        toast.error("Error fetching employee details");
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!employee) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active": return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none shadow-none">Active</Badge>;
      case "Terminated": return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-none shadow-none">Terminated</Badge>;
      case "Resigned": return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-none shadow-none">Resigned</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const InfoRow = ({ label, value, icon: Icon, className }: { label: string, value?: any, icon?: any, className?: string }) => (
    <div className={cn("flex flex-col gap-1.5 p-3 rounded-xl bg-muted/30 border border-muted/50 transition-all hover:bg-muted/50", className)}>
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </div>
      <div className="text-[15px] font-medium text-foreground min-h-[1.25rem]">
        {value || <span className="text-muted-foreground/50 font-normal italic">Not provided</span>}
      </div>
    </div>
  );

  const FileCard = ({ label, url, icon: Icon }: { label: string, url?: string, icon: any }) => (
    <Card className="overflow-hidden border-dashed border-2 hover:border-primary/50 transition-all group">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground">{url ? "Document uploaded" : "No document"}</p>
          </div>
        </div>
        {url && (
          <Button variant="ghost" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">View</a>
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
        
        {/* LEFT COLUMN: Profile & Key Stats (Sidebar) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border shadow-sm bg-white/50 backdrop-blur-md overflow-hidden ring-1 ring-black/5">
            <div className="h-24 bg-gradient-to-r from-primary/5 to-primary/[0.02]" />
            <CardContent className="px-6 pb-8 -mt-12">
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden bg-muted border-[3px] border-white shadow-md transition-transform duration-300">
                    {employee.profileImage ? (
                      <img src={employee.profileImage} alt={employee.firstName} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-16 h-16 text-muted-foreground" />
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2">
                      {getStatusBadge(employee.status)}
                  </div>
                </div>
                
                <div className="mt-6 flex flex-col items-center gap-2">
                  <div className="flex gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] uppercase border-primary/20 text-primary bg-primary/5">
                      EE: {employee.eeCode || "N/A"}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] uppercase border-none">
                      {employee.type || "Employee"}
                    </Badge>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">General Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/10 border border-muted/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-100/40 text-blue-600">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">Rate</span>
                </div>
                <span className="font-bold text-lg">${employee.rate || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/10 border border-muted/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-100/40 text-purple-600">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">Hired</span>
                </div>
                <span className="font-bold text-sm">
                  {employee.hiredDate ? format(new Date(employee.hiredDate), "MMM dd, yyyy") : "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-white">
            <CardHeader className="pb-2 px-6 pt-6">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Weekly Availability</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-2">
              <div className="space-y-3 mt-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                  const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][idx];
                  const status = String(employee[dayKey as keyof ISymxEmployee] || 'OFF');
                  
                  return (
                    <div key={day} className="flex items-center justify-between py-2 border-b border-muted/30 last:border-0">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{day}</span>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 border-none",
                          status === 'Route' && "bg-blue-100/50 text-blue-700",
                          status === 'Assign Schedule' && "bg-purple-100/50 text-purple-700",
                          status === 'Open' && "bg-green-100/50 text-green-700",
                          status === 'Close' && "bg-yellow-100/50 text-yellow-700",
                          status === 'OFF' && "bg-muted/30 text-muted-foreground/60"
                        )}
                      >
                        {status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
              {employee.ScheduleNotes && (
                <div className="mt-6 p-4 rounded-2xl bg-muted/10 border border-muted/20">
                  <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-widest flex items-center gap-2">
                    <CalendarCheck className="w-3 h-3" /> Notes
                  </p>
                  <p className="text-xs text-foreground/80 italic leading-relaxed">
                    {employee.ScheduleNotes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Tabs and Details */}
        <div className="lg:col-span-8">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-muted/30 p-1 rounded-2xl inline-flex gap-1 h-auto mb-8 border">
              <TabsTrigger 
                value="overview" 
                className="rounded-[0.9rem] px-6 py-2 font-bold text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-muted/30 transition-all"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="logistics" 
                className="rounded-[0.9rem] px-6 py-2 font-bold text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-muted/30 transition-all"
              >
                Logistics
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="rounded-[0.9rem] px-6 py-2 font-bold text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-muted/30 transition-all"
              >
                Documents
              </TabsTrigger>
              {(employee.status === 'Terminated' || employee.status === 'Resigned' || employee.terminationDate || employee.resignationDate) && (
                <TabsTrigger 
                  value="offboarding" 
                  className="rounded-[0.9rem] px-6 py-2 font-bold text-sm data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-muted/30 transition-all text-red-500/70"
                >
                  Offboarding
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-xl tracking-tight">Employee Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoRow label="Email" value={employee.email} icon={Mail} />
                  <InfoRow label="Phone" value={employee.phoneNumber} icon={Phone} />
                  <InfoRow label="Gender" value={employee.gender} icon={User} />
                  <InfoRow label="DOB" value={employee.dob ? format(new Date(employee.dob), "MMM dd, yyyy") : null} icon={Calendar} />
                  <InfoRow label="Hourly Status" value={employee.hourlyStatus} icon={Clock} />
                  <InfoRow label="Eligibility" value={employee.eligibility ? "Eligible" : "Ineligible"} icon={ShieldCheck} className={employee.eligibility ? "bg-green-50/40 border-green-100" : "bg-red-50/40 border-red-100"} />
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-xl tracking-tight">Primary Address</h3>
                </div>
                <Card className="border shadow-sm overflow-hidden bg-white/40 backdrop-blur-sm">
                  <CardContent className="p-6 flex flex-col md:flex-row gap-8">
                    <div className="space-y-4 flex-1">
                      <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Street</p>
                          <p className="text-[15px] font-bold">{employee.streetAddress || "- -"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">City</p>
                          <p className="text-[15px] font-bold">{employee.city || "- -"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">State</p>
                          <p className="text-[15px] font-bold">{employee.state || "- -"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Zip Code</p>
                          <p className="text-[15px] font-bold font-mono tracking-tighter">{employee.zipCode || "- -"}</p>
                        </div>
                      </div>
                    </div>
                    <div className="hidden md:flex w-40 h-32 rounded-[2rem] bg-gradient-to-br from-primary/5 to-primary/10 items-center justify-center border-2 border-primary/10 border-dashed">
                      <MapPin className="w-10 h-10 text-primary opacity-20" />
                    </div>
                  </CardContent>
                </Card>
              </section>
            </TabsContent>

            <TabsContent value="logistics" className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Truck className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-xl tracking-tight">Vehicle Assignments</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InfoRow label="Primary Van" value={employee.defaultVan1} icon={Truck} />
                  <InfoRow label="Backup Van 1" value={employee.defaultVan2} icon={Truck} />
                  <InfoRow label="Backup Van 1" value={employee.defaultVan3} icon={Truck} />
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <IdCard className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-xl tracking-tight">Identification & Details</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoRow label="Badge #" value={employee.badgeNumber} icon={IdCard} />
                  <InfoRow label="Transporter ID" value={employee.transporterId} icon={Briefcase} />
                  <InfoRow label="Gas Card PIN" value={employee.gasCardPin} icon={ShieldCheck} />
                  <InfoRow label="Routes Comp" value={employee.routesComp} icon={Building2} />
                  <InfoRow label="DL Expiration" value={employee.dlExpiration ? format(new Date(employee.dlExpiration), "MMM dd, yyyy") : null} icon={Calendar} />
                  <InfoRow label="MVR Date" value={employee.motorVehicleReportDate ? format(new Date(employee.motorVehicleReportDate), "MMM dd, yyyy") : null} icon={Calendar} />
                </div>
              </section>
            </TabsContent>

            <TabsContent value="documents" className="pt-2 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FileCard label="Offer Letter" url={employee.offerLetterFile} icon={FileText} />
                <FileCard label="Employee Handbook" url={employee.handbookFile} icon={FileText} />
                <FileCard label="Driver's License" url={employee.driversLicenseFile} icon={IdCard} />
                <FileCard label="I-9 Documents" url={employee.i9File} icon={ShieldCheck} />
                <FileCard label="Drug Test Results" url={employee.drugTestFile} icon={CheckCircle2} />
                <FileCard label="Final Check Cleared" url={employee.finalCheck} icon={DollarSign} />
              </div>
            </TabsContent>

            <TabsContent value="offboarding" className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="p-6 rounded-[2rem] bg-red-50/30 border border-red-100 flex items-start gap-4 backdrop-blur-sm">
                <div className="p-3 rounded-2xl bg-red-100/50 text-red-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-red-800 text-lg">Offboarding Record</h3>
                  <p className="text-sm text-red-600/80 leading-relaxed font-medium">This profile contains sensitive termination or resignation data documented for system records.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="space-y-4">
                  <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-3">
                    <XCircle className="w-3 h-3 text-red-400" /> Termination
                  </h4>
                  <div className="space-y-4">
                    <InfoRow label="Date" value={employee.terminationDate ? format(new Date(employee.terminationDate), "MMM dd, yyyy") : null} icon={Calendar} className="bg-red-50/20" />
                    <InfoRow label="Reason" value={employee.terminationReason} icon={AlertTriangle} className="bg-red-50/20" />
                    <FileCard icon={FileText} label="Termination Letter" url={employee.terminationLetter} />
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-3">
                    <XCircle className="w-3 h-3 text-orange-400" /> Resignation
                  </h4>
                  <div className="space-y-4">
                    <InfoRow label="Date" value={employee.resignationDate ? format(new Date(employee.resignationDate), "MMM dd, yyyy") : null} icon={Calendar} className="bg-orange-50/20" />
                    <InfoRow label="Type" value={employee.resignationType} icon={AlertTriangle} className="bg-orange-50/20" />
                    <FileCard icon={FileText} label="Resignation Letter" url={employee.resignationLetter} />
                  </div>
                </section>
              </div>

              <section className="pt-8 border-t border-dashed space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoRow label="Last Date Worked" value={employee.lastDateWorked ? format(new Date(employee.lastDateWorked), "MMM dd, yyyy") : null} icon={Calendar} />
                  <div className="flex flex-col gap-4 p-4 rounded-2xl bg-muted/10 border border-dashed border-muted/30">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">System Status</p>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2 text-[13px] font-bold">
                        {employee.paycomOffboarded ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-muted-foreground/20" />}
                        Paycom
                      </div>
                      <div className="flex items-center gap-2 text-[13px] font-bold">
                        {employee.amazonOffboarded ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-muted-foreground/20" />}
                        Amazon
                      </div>
                      <div className="flex items-center gap-2 text-[13px] font-bold">
                        {employee.finalCheckIssued ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-muted-foreground/20" />}
                        Final Check
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 px-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <FileText className="w-3 h-3" /> Exit Interview Notes
                  </p>
                  <div className="p-5 rounded-3xl bg-muted/10 border border-muted/20 text-[15px] leading-relaxed text-foreground min-h-[120px] font-medium italic">
                    {employee.exitInterviewNotes || "No exit interview notes documented."}
                  </div>
                </div>
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee Profile</DialogTitle>
          </DialogHeader>
          <EmployeeForm 
            initialData={{ ...employee, _id: String(employee._id) }} 
            onSubmit={async (data) => {
              try {
                const res = await fetch(`/api/admin/employees/${employee._id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(data),
                });
                if (res.ok) {
                  const updated = await res.json();
                  setEmployee(updated);
                  setIsEditDialogOpen(false);
                  toast.success("Profile updated successfully");
                }
              } catch (e) {
                toast.error("Failed to update profile");
              }
            }} 
            isLoading={false} 
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
