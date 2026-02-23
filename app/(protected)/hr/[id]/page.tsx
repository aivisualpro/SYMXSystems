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
  CalendarCheck,
  TrendingUp,
  Star,
  Zap,
  Award,
  BarChart3,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ISymxEmployee } from "@/lib/models/SymxEmployee";
import { cn, formatPhoneNumber } from "@/lib/utils";
import { format, startOfWeek, addDays } from "date-fns";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { EmployeeForm } from "@/components/admin/employee-form";
import { EmployeeScorecard } from "@/components/hr/employee-scorecard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PageProps = {
  params: Promise<{ id: string }>;
};

/* ── Availability Card (top-level for perf) ── */
const AvailabilityCard = ({ day, date, status, dayKey, handleStatusChange }: any) => {
  const statusConfig: Record<string, { icon: any; color: string; bg: string; border: string; text: string }> = {
    'Route':           { icon: Truck,         color: 'text-[#16C47F]',     bg: 'bg-[#16C47F]/10',     border: 'border-[#16C47F]/20',   text: 'text-[#16C47F]' },
    'Assign Schedule': { icon: CalendarCheck,  color: 'text-[#F29727]',     bg: 'bg-[#F29727]/10',     border: 'border-[#F29727]/20',   text: 'text-[#F29727]' },
    'Open':            { icon: CheckCircle2,   color: 'text-[#D2665A]',     bg: 'bg-[#D2665A]/10',     border: 'border-[#D2665A]/20',   text: 'text-[#D2665A]' },
    'Close':           { icon: Clock,          color: 'text-[#FFB4A2]',     bg: 'bg-[#FFB4A2]/10',     border: 'border-[#FFB4A2]/20',   text: 'text-[#FFB4A2]' },
    'OFF':             { icon: XCircle,        color: 'text-[#5E686D]',     bg: 'bg-transparent',      border: 'border-[#5E686D]/20',   text: 'text-[#5E686D]' },
  };
  const config = statusConfig[status] || statusConfig['OFF'];
  const Icon = config.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          "flex flex-col items-center justify-center p-3 rounded-2xl border transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden h-full min-h-[90px] cursor-pointer",
          config.bg, config.border
        )}>
          <div className="flex flex-col items-center mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 group-hover:text-foreground transition-colors leading-none mb-1">{day}</span>
            <span className="text-[9px] font-bold text-muted-foreground/40 leading-none">{date}</span>
          </div>
          <Icon className={cn("w-5 h-5 mb-2 transition-transform group-hover:scale-110", config.color)} />
          <span className={cn("text-[9px] font-black uppercase tracking-tighter leading-none whitespace-nowrap", config.text)}>
            {status === 'Assign Schedule' ? 'Assign' : status}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-[160px] rounded-xl p-1.5 shadow-2xl border border-border bg-popover/95 backdrop-blur-md">
        {Object.entries(statusConfig).map(([id, cfg]) => (
          <DropdownMenuItem 
            key={id} 
            onClick={() => handleStatusChange(dayKey, id)}
            className={cn(
              "text-[10px] font-bold py-2.5 px-3 rounded-lg cursor-pointer flex items-center justify-between transition-colors",
              status === id ? "bg-primary/10 text-primary" : "hover:bg-accent"
            )}
          >
            <div className="flex items-center gap-2.5">
              <div className={cn("p-1 rounded-md", cfg.bg)}>
                <cfg.icon className={cn("w-3.5 h-3.5", cfg.color)} />
              </div>
              {id}
            </div>
            {status === id && <CheckCircle2 className="w-3 h-3 text-primary animate-in zoom-in-50 duration-300" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/* ── Performance Stat Card ── */
const PerformanceMetric = ({ label, value, icon: Icon, accent, trend, progressColor }: { label: string; value: string | number; icon: any; accent: string; trend?: string; progressColor?: string }) => {
  const isPercentage = typeof value === 'string' && value.includes('%');
  const numericValue = isPercentage ? parseInt(value as string) : 0;

  return (
    <div className={cn(
      "relative p-4 rounded-2xl border bg-card backdrop-blur-sm transition-all hover:shadow-md group overflow-hidden",
      "border-border/60 hover:border-border dark:border-white/10 dark:hover:border-white/20 dark:bg-white/[0.04]"
    )}>
      <div className={cn("absolute top-0 left-0 w-1 h-full rounded-r-full", accent)} />
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
        <div className="p-1.5 rounded-lg bg-muted/40 dark:bg-white/[0.06] group-hover:bg-muted dark:group-hover:bg-white/10 transition-colors">
          <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <span className="text-2xl font-black tracking-tight text-foreground leading-none">{value}</span>
          {trend && (
            <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 flex items-center gap-0.5 mb-0.5">
              <TrendingUp className="w-3 h-3" /> {trend}
            </span>
          )}
        </div>
        {isPercentage && progressColor && (
          <div className="h-1.5 w-full bg-muted/50 dark:bg-white/10 rounded-full overflow-hidden mt-1">
            <div 
              className={cn("h-full rounded-full transition-all duration-1000 ease-out", progressColor)} 
              style={{ width: `${numericValue}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default function EmployeeDetailPage(props: PageProps) {
  const params = use(props.params);
  const router = useRouter();
  const [employee, setEmployee] = useState<ISymxEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { setLeftContent, setRightContent } = useHeaderActions();

  const handleStatusChange = async (dayKey: string, newStatus: string) => {
    if (!employee) return;
    
    const oldEmployee = employee;
    const updatedEmployee = { ...employee, [dayKey]: newStatus };
    setEmployee(updatedEmployee as ISymxEmployee);
    
    try {
      const response = await fetch(`/api/admin/employees/${employee._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [dayKey]: newStatus }),
      });
      
      if (!response.ok) throw new Error("Failed to update availability");
      toast.success(`${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)} updated`);
    } catch (error) {
      setEmployee(oldEmployee);
      toast.error("Failed to update availability");
    }
  };

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
          router.push("/hr");
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
      case "Active": return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 border-none shadow-none text-[10px] font-bold">Active</Badge>;
      case "Terminated": return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-500/15 border-none shadow-none text-[10px] font-bold">Terminated</Badge>;
      case "Resigned": return <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 hover:bg-orange-500/15 border-none shadow-none text-[10px] font-bold">Resigned</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const InfoRow = ({ label, value, icon: Icon, className }: { label: string, value?: any, icon?: any, className?: string }) => (
    <div className={cn("flex flex-col gap-1.5 p-3 rounded-xl bg-muted/30 dark:bg-white/[0.04] border border-border/50 dark:border-white/10 transition-all hover:bg-muted/50 dark:hover:bg-white/[0.08]", className)}>
      <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className="text-sm font-semibold text-foreground min-h-[1.25rem]">
        {value || <span className="text-muted-foreground/50 font-normal italic text-xs">Not provided</span>}
      </div>
    </div>
  );

  const FileCard = ({ label, url, icon: Icon }: { label: string, url?: string, icon: any }) => (
    <Card className="overflow-hidden border-dashed border-2 border-border/50 dark:border-white/10 hover:border-primary/50 transition-all group bg-card">
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ════════ LEFT COLUMN: Profile + Employee Info ════════ */}
        <div className="lg:col-span-4 space-y-5">
          {/* ── Redesigned Profile Card + Address ── */}
          <Card className="border border-zinc-200 dark:border-zinc-800 shadow-none bg-card rounded-[32px] overflow-hidden">
            <CardContent className="p-6">
               {/* Header Link - Flex Row */}
               <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-8">
                  {/* Avatar - Left */}
                  <div className="relative shrink-0">
                     <div className="w-24 h-24 rounded-full overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-sm bg-muted/20">
                        {employee.profileImage ? (
                           <img src={employee.profileImage} alt={employee.firstName} className="w-full h-full object-cover" />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 text-muted-foreground">
                              <User className="w-10 h-10 opacity-50" />
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Name & Status - Right */}
                  <div className="text-center sm:text-left space-y-1.5 pt-1.5 flex-1">
                     <h2 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none break-words">
                        {employee.firstName}<br/>{employee.lastName}
                     </h2>
                     <div className="flex flex-wrap gap-2 justify-center sm:justify-start items-center">
                        {getStatusBadge(employee.status)}
                        <span className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-muted-foreground uppercase tracking-wide border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-default">
                           {employee.type || "Employee"}
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-muted-foreground uppercase tracking-wide border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-default">
                           {employee.eeCode || "N/A"}
                        </span>
                     </div>
                  </div>
               </div>

               {/* Info Blocks */}
               <div className="space-y-6">
                  {/* Contact Info */}
                  <div className="space-y-3">
                     <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="flex items-center gap-2">
                           <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                           <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Email</span>
                        </div>
                        <span className="text-xs font-bold text-foreground truncate max-w-[180px]">{employee.email || "—"}</span>
                     </div>
                     <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="flex items-center gap-2">
                           <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                           <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Phone</span>
                        </div>
                        <span className="text-xs font-bold text-foreground">{formatPhoneNumber(employee.phoneNumber || "")}</span>
                     </div>
                     <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30">
                        <div className="flex items-center gap-2">
                           <DollarSign className="w-3.5 h-3.5 text-blue-500" />
                           <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Rate</span>
                        </div>
                        <span className="text-sm font-black text-blue-700 dark:text-blue-300">${employee.rate || 0}</span>
                     </div>

                     {/* Chips Moved Here */}
                     <div className="flex flex-wrap gap-2 pt-1">
                        <div className="px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                           <User className="w-3 h-3" />
                           {employee.gender || "N/A"}
                        </div>
                        <div className="px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                           <Calendar className="w-3 h-3" />
                           {employee.dob ? format(new Date(employee.dob), "MMM d") : "N/A"}
                        </div>
                        <div className={cn(
                           "px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase flex items-center gap-1.5",
                           employee.eligibility 
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" 
                              : "border-red-200 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                        )}>
                           <div className={cn("w-1.5 h-1.5 rounded-full", employee.eligibility ? "bg-emerald-500" : "bg-red-500")} />
                           {employee.eligibility ? "Eligible" : "Ineligible"}
                        </div>
                     </div>
                  </div>

                  <Separator className="bg-border/40" />

                  {/* Inline Address Section */}
                  <div className="space-y-3">
                     <div className="p-4 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-muted-foreground/70 mt-0.5 shrink-0" />
                        <p className="text-xs font-bold text-foreground leading-relaxed">
                           {[
                              employee.streetAddress,
                              employee.city,
                              employee.state,
                              employee.zipCode
                           ].filter(Boolean).join(", ") || "No address provided"}
                        </p>
                     </div>
                  </div>

                  <Separator className="bg-border/40" />

                  {/* Merged Weekly Schedule */}
                  <div className="space-y-4">
                     <div className="flex items-center gap-2 px-1">
                        <CalendarCheck className="w-3.5 h-3.5 text-muted-foreground/70" />
                        <span className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">Weekly Schedule</span>
                     </div>
                     <div className="space-y-2">
                        {/* Top Row: 3 Days */}
                        <div className="grid grid-cols-3 gap-2">
                           {['Sun', 'Mon', 'Tue'].map((day, idx) => {
                              const dayKey = ['sunday', 'monday', 'tuesday'][idx];
                              const status = String(employee[dayKey as keyof ISymxEmployee] || 'OFF');
                              const date = format(addDays(startOfWeek(new Date()), idx), "MMM d");
                              return (
                                 <AvailabilityCard key={day} day={day} date={date} status={status} dayKey={dayKey} handleStatusChange={handleStatusChange} />
                              );
                           })}
                        </div>
                        {/* Bottom Row: 4 Days */}
                        <div className="grid grid-cols-4 gap-2">
                           {['Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                              const dayKey = ['wednesday', 'thursday', 'friday', 'saturday'][idx];
                              const status = String(employee[dayKey as keyof ISymxEmployee] || 'OFF');
                              const date = format(addDays(startOfWeek(new Date()), idx + 3), "MMM d");
                              return (
                                 <AvailabilityCard key={day} day={day} date={date} status={status} dayKey={dayKey} handleStatusChange={handleStatusChange} />
                              );
                           })}
                        </div>
                     </div>
                     {employee.ScheduleNotes && (
                        <div className="p-3 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
                           <p className="text-[11px] text-foreground/70 italic leading-relaxed font-medium">
                              {employee.ScheduleNotes}
                           </p>
                        </div>
                     )}
                  </div>


               </div>
            </CardContent>
          </Card>
        </div>

        {/* ════════ RIGHT COLUMN: Schedule + Tabs ════════ */}
        <div className="lg:col-span-8 space-y-6">
          <Tabs defaultValue="scorecard" className="w-full">
            <TabsList className="bg-muted/30 dark:bg-white/[0.04] p-1 rounded-2xl inline-flex gap-1 h-auto mb-6 border border-border/50 dark:border-white/10">
              <TabsTrigger 
                value="scorecard" 
                className="rounded-[0.9rem] px-5 py-2 font-bold text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border/30 transition-all"
              >
                Scorecard
              </TabsTrigger>
              <TabsTrigger 
                value="logistics" 
                className="rounded-[0.9rem] px-5 py-2 font-bold text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border/30 transition-all"
              >
                Logistics
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="rounded-[0.9rem] px-5 py-2 font-bold text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border/30 transition-all"
              >
                Documents
              </TabsTrigger>
              {(employee.status === 'Terminated' || employee.status === 'Resigned' || employee.terminationDate || employee.resignationDate) && (
                <TabsTrigger 
                  value="offboarding" 
                  className="rounded-[0.9rem] px-5 py-2 font-bold text-xs data-[state=active]:bg-card data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border/30 transition-all text-red-500/70"
                >
                  Offboarding
                </TabsTrigger>
              )}
            </TabsList>

            {/* ──────── SCORECARD TAB ──────── */}
            <TabsContent value="scorecard" className="animate-in fade-in slide-in-from-right-2 duration-300">
              <EmployeeScorecard transporterId={employee.transporterId || ''} />
            </TabsContent>

            {/* ──────── LOGISTICS TAB ──────── */}
            <TabsContent value="logistics" className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <section className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Truck className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-sm tracking-tight text-foreground">Vehicle Assignments</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <InfoRow label="Primary Van" value={employee.defaultVan1} icon={Truck} />
                  <InfoRow label="Backup Van 1" value={employee.defaultVan2} icon={Truck} />
                  <InfoRow label="Backup Van 2" value={employee.defaultVan3} icon={Truck} />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <IdCard className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-sm tracking-tight text-foreground">Identification & Details</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <InfoRow label="Badge #" value={employee.badgeNumber} icon={IdCard} />
                  <InfoRow label="Transporter ID" value={employee.transporterId} icon={Briefcase} />
                  <InfoRow label="Gas Card PIN" value={employee.gasCardPin} icon={ShieldCheck} />
                  <InfoRow label="Routes Comp" value={employee.routesComp} icon={Building2} />
                  <InfoRow label="DL Expiration" value={employee.dlExpiration ? format(new Date(employee.dlExpiration), "MMM dd, yyyy") : null} icon={Calendar} />
                  <InfoRow label="MVR Date" value={employee.motorVehicleReportDate ? format(new Date(employee.motorVehicleReportDate), "MMM dd, yyyy") : null} icon={Calendar} />
                </div>
              </section>
            </TabsContent>

            {/* ──────── DOCUMENTS TAB ──────── */}
            <TabsContent value="documents" className="pt-2 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileCard label="Offer Letter" url={employee.offerLetterFile} icon={FileText} />
                <FileCard label="Employee Handbook" url={employee.handbookFile} icon={FileText} />
                <FileCard label="Driver's License" url={employee.driversLicenseFile} icon={IdCard} />
                <FileCard label="I-9 Documents" url={employee.i9File} icon={ShieldCheck} />
                <FileCard label="Drug Test Results" url={employee.drugTestFile} icon={CheckCircle2} />
                <FileCard label="Final Check Cleared" url={employee.finalCheck} icon={DollarSign} />
              </div>
            </TabsContent>

            {/* ──────── OFFBOARDING TAB ──────── */}
            <TabsContent value="offboarding" className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="p-5 rounded-2xl bg-red-500/5 dark:bg-red-500/10 border border-red-200/30 dark:border-red-500/20 flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-red-800 dark:text-red-300 text-base">Offboarding Record</h3>
                  <p className="text-xs text-red-600/80 dark:text-red-400/60 leading-relaxed font-medium">This profile contains sensitive termination or resignation data.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-1">
                    <XCircle className="w-3 h-3 text-red-400" /> Termination
                  </h4>
                  <div className="space-y-3">
                    <InfoRow label="Date" value={employee.terminationDate ? format(new Date(employee.terminationDate), "MMM dd, yyyy") : null} icon={Calendar} className="bg-red-500/5 dark:bg-red-500/10 border-red-200/30 dark:border-red-500/20" />
                    <InfoRow label="Reason" value={employee.terminationReason} icon={AlertTriangle} className="bg-red-500/5 dark:bg-red-500/10 border-red-200/30 dark:border-red-500/20" />
                    <FileCard icon={FileText} label="Termination Letter" url={employee.terminationLetter} />
                  </div>
                </section>

                <section className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-1">
                    <XCircle className="w-3 h-3 text-orange-400" /> Resignation
                  </h4>
                  <div className="space-y-3">
                    <InfoRow label="Date" value={employee.resignationDate ? format(new Date(employee.resignationDate), "MMM dd, yyyy") : null} icon={Calendar} className="bg-orange-500/5 dark:bg-orange-500/10 border-orange-200/30 dark:border-orange-500/20" />
                    <InfoRow label="Type" value={employee.resignationType} icon={AlertTriangle} className="bg-orange-500/5 dark:bg-orange-500/10 border-orange-200/30 dark:border-orange-500/20" />
                    <FileCard icon={FileText} label="Resignation Letter" url={employee.resignationLetter} />
                  </div>
                </section>
              </div>

              <section className="pt-6 border-t border-dashed border-border/50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow label="Last Date Worked" value={employee.lastDateWorked ? format(new Date(employee.lastDateWorked), "MMM dd, yyyy") : null} icon={Calendar} />
                  <div className="flex flex-col gap-3 p-4 rounded-2xl bg-muted/10 dark:bg-white/[0.03] border border-dashed border-border/30 dark:border-white/[0.08]">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pl-1">System Status</p>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        {employee.paycomOffboarded ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-muted-foreground/20" />}
                        Paycom
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold">
                        {employee.amazonOffboarded ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-muted-foreground/20" />}
                        Amazon
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold">
                        {employee.finalCheckIssued ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-muted-foreground/20" />}
                        Final Check
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 px-1">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <FileText className="w-3 h-3" /> Exit Interview Notes
                  </p>
                  <div className="p-4 rounded-2xl bg-muted/10 dark:bg-white/[0.03] border border-border/20 dark:border-white/[0.06] text-sm leading-relaxed text-foreground/80 min-h-[100px] font-medium italic">
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
