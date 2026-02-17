
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  CheckCircle2, 
  Shield, 
  AlertTriangle, 
  Search, 
  ChevronDown, 
  ChevronRight 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { cn } from "@/lib/utils";

// Hardcoded fallback — used only when the API hasn't responded yet
const FALLBACK_MODULES: any[] = [
  { 
    group: "Application Modules", 
    items: [
      { name: "Dashboard" },
      { name: "Owner", subModules: ["App Users"] },
      { name: "Dispatch", subModules: ["Roster", "Performance Dashboard", "Opening", "Attendance", "Repairs", "Loadout", "Time", "Schedule", "Closing", "Contacts", "Verbal Coaching", "Messaging", "Efficiency", "Routes", "Incidents", "Coaching", "Checklist"] },
      { name: "Scheduling" },
      { name: "Everyday" },
      { name: "Fleet" },
      { name: "HR", subModules: ["Employees"] },
      { name: "Incidents" }, 
      { name: "Insurance" }, 
      { name: "Manager", subModules: ["Routes Manager", "Punch Ins Manager", "Punch Ins Import", "RTS Manager", "Rescue Manager", "Driver Efficiency Manager", "Performance Summary", "Scorecard Performance", "Employee Ranking", "HR Tickets Managers", "Notices", "Work Hours Compliance", "Paycom Schedule Export", "Work Summary Tool", "Fleet Summary", "Repairs", "Scorecard History", "Weekly ScoreCard", "Lunch Compliance"] },
      { name: "Reports", subModules: ["Company Performance Dashboard"] },
      { name: "Notifications" }, 
      { name: "Settings" }
    ] 
  },
];

const PERMISSION_ACTIONS = [
  { key: "view", label: "View" },
  { key: "create", label: "Add" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
  { key: "approve", label: "Approve" },
  { key: "download", label: "Download" },
];

// field definitions based on Mongoose schemas
const MODULE_FIELDS: Record<string, string[]> = {
  Users: ["Name", "Email", "Phone", "Address", "Role", "Designation", "Bio Description", "Status", "Profile Picture", "Serial No"],
  Employees: ["EE Code", "First Name", "Last Name", "Email", "Phone", "Address", "Status", "Role", "Hired Date", "Termination Date"],
  Dashboard: ["Overview Stats", "Recent Activity", "Performance Charts", "Notifications Preview"],
  Settings: ["General Settings", "Roles Management", "Import/Export", "System Config"],
  Notifications: ["Email Alerts", "System Notifications", "Push Notifications"],
  Owner: ["Overview", "Vitals", "Reports", "Revenue", "Profitability"],
  Dispatch: ["Master Feed", "Schedule Board", "Driver View", "Job Tickets"],
  HR: ["Employee List", "Attendance", "Payroll", "Appraisals"],
  Manager: ["Weekly Scorecard", "Performance Tracking", "Goal Management"],
  Reports: ["Financials", "Operational", "Inventory", "Payroll"]
};

export default function RoleDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const roleId = params.id as string;

  const [role, setRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [systemModules, setSystemModules] = useState<any[]>(FALLBACK_MODULES);

  const toggleExpand = (name: string) => {
    setExpandedModules(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  // Fetch dynamic modules from DB
  useEffect(() => {
    const fetchModules = async () => {
      try {
        const res = await fetch('/api/admin/modules');
        if (res.ok) {
          const data = await res.json();
          if (data.modules?.length > 0) {
            // Transform DB modules into the SYSTEM_MODULES format
            const dynamicItems = data.modules.map((m: any) => ({
              name: m.name,
              ...(m.subModules?.length > 0 ? { subModules: m.subModules.map((sm: any) => sm.name) } : {}),
            }));
            // Add Notifications and Settings (they are nav-secondary, not stored in DB modules)
            const hasNotifications = dynamicItems.some((i: any) => i.name === "Notifications");
            const hasSettings = dynamicItems.some((i: any) => i.name === "Settings");
            if (!hasNotifications) dynamicItems.push({ name: "Notifications" });
            if (!hasSettings) dynamicItems.push({ name: "Settings" });

            setSystemModules([{ group: "Application Modules", items: dynamicItems }]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch dynamic modules", error);
      }
    };
    fetchModules();
  }, []);

  // Fetch role details
  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await fetch(`/api/admin/roles/${roleId}`);
        if (!res.ok) throw new Error("Failed to fetch role");
        const data = await res.json();
        
        // Ensure permissions array exists and is populated
        if (!data.permissions) {
             data.permissions = [];
        }
        
        setRole(data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load role details");
        router.push("/admin/settings/roles");
      } finally {
        setLoading(false);
      }
    };

    if (roleId) {
      fetchRole();
    }
  }, [roleId, router]);

  // Helper to get or create permission object for a module
  const getPermission = (moduleName: string) => {
    if (!role) return null;
    let perm = role.permissions.find((p: any) => p.module === moduleName);
    if (!perm) {
      // Create default permission object if missing
      perm = {
        module: moduleName,
        actions: {
          view: true,
          create: true,
          edit: true,
          delete: true,
          approve: true,
          download: true,
        },
        fieldScope: {},
      };
    }
    return perm;
  };

  const handleToggleAction = (moduleName: string, actionKey: string, currentValue: boolean) => {
    setRole((prev: any) => {
      const newPermissions = [...prev.permissions];
      const existingPermIndex = newPermissions.findIndex((p: any) => p.module === moduleName);
      const newValue = !currentValue;

      if (existingPermIndex >= 0) {
        const currentActions = { ...newPermissions[existingPermIndex].actions };
        currentActions[actionKey] = newValue;

        // Dependency Logic
        if (actionKey === 'view' && !newValue) {
            // Uncheck everything if View is disabled
            Object.keys(currentActions).forEach(key => {
                if (key !== 'view') currentActions[key] = false;
            });
        } else if (actionKey !== 'view' && newValue) {
            // Enforce View if any other action is enabled
            currentActions.view = true;
        }

        newPermissions[existingPermIndex] = {
          ...newPermissions[existingPermIndex],
          actions: currentActions,
        };
      } else {
        // Initialize new permission
        const newActions = {
            view: true, create: true, edit: true, delete: true, approve: true, download: true,
            [actionKey]: newValue 
        };
        
        // Apply same dependency logic for new entry
        if (actionKey === 'view' && !newValue) {
             Object.keys(newActions).forEach(key => {
                if (key !== 'view') newActions[key] = false;
            });
        }
        
        const newPerm = {
          module: moduleName,
          actions: newActions,
          fieldScope: {}
        };
        newPermissions.push(newPerm);
      }
      return { ...prev, permissions: newPermissions };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/roles/${roleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(role),
      });

      if (!res.ok) throw new Error("Failed to save role");
      
      toast.success("Role permissions updated successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // State for search
  const [searchQuery, setSearchQuery] = useState("");

  const { setLeftContent, setRightContent } = useHeaderActions();

  // Inject Header Content
  useEffect(() => {
    if (!role) return;

    setLeftContent(
      <div className="flex items-center gap-2">
         <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2">
            <ArrowLeft className="h-4 w-4" />
         </Button>
         <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">{role.name}</h1>
         </div>
      </div>
    );

    setRightContent(
        <div className="flex items-center gap-2">
           <div className="relative w-64 hidden md:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search modules..."
                className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
           <Separator orientation="vertical" className="h-6 mx-1" />
           <Button onClick={handleSave} disabled={saving} size="sm">
             {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
             Save Changes
           </Button>
        </div>
    );

    return () => {
        setLeftContent(null);
        setRightContent(null);
    };
  }, [role, saving, router, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!role) return null;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">

      <Tabs defaultValue="modules" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2">
            <TabsTrigger value="modules">Modules</TabsTrigger>
            <TabsTrigger value="scope">Scope</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="modules" className="flex-1 mt-6 border rounded-lg overflow-hidden m-1">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="w-[200px]">Application Modules</TableHead>
                  <TableHead className="text-center">View</TableHead>
                  <TableHead className="text-center">Add</TableHead>
                  <TableHead className="text-center">Edit</TableHead>
                  <TableHead className="text-center">Delete</TableHead>
                  <TableHead className="text-center">Approve</TableHead>
                  <TableHead className="text-center">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemModules.map((group: any) => {
                  return (
                    <React.Fragment key={group.group}>
                      {group.items.map((item: any) => {
                        const moduleName = typeof item === 'string' ? item : item.name;
                        const subModules = item.subModules || [];
                        const hasSubModules = subModules.length > 0;
                        const isExpanded = expandedModules.includes(moduleName);
                        
                        // Filter logic
                        if (searchQuery && !moduleName.toLowerCase().includes(searchQuery.toLowerCase())) {
                          const hasMatchingChild = subModules.some((sm: string) => sm.toLowerCase().includes(searchQuery.toLowerCase()));
                          if (!hasMatchingChild) return null;
                        }

                        const perm = getPermission(moduleName);
                        const isViewEnabled = perm ? perm.actions.view : true;

                        return (
                          <React.Fragment key={moduleName}>
                            {/* Parent Row */}
                            <TableRow 
                              className={cn(
                                "hover:bg-muted/50 transition-colors", 
                                hasSubModules && isViewEnabled && "cursor-pointer",
                                hasSubModules && "bg-muted/10"
                              )}
                              onClick={() => {
                                if (hasSubModules && isViewEnabled) toggleExpand(moduleName);
                              }}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {hasSubModules && (
                                    <div className="h-6 w-6 flex items-center justify-center">
                                      {isExpanded && isViewEnabled ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </div>
                                  )}
                                  <span className={cn(!hasSubModules && "ml-8")}>{moduleName}</span>
                                </div>
                              </TableCell>
                              
                              {/* Parent Toggles */}
                              {PERMISSION_ACTIONS.map((action) => {
                                if (hasSubModules && action.key !== 'view') {
                                  return <TableCell key={action.key} className="text-center">-</TableCell>;
                                }

                                const isEnabled = perm ? perm.actions[action.key] : true;
                                const isDisabled = action.key !== 'view' && !isViewEnabled;
                                
                                return (
                                  <TableCell key={action.key} className="text-center">
                                    <div className="flex justify-center">
                                      <Switch 
                                         checked={isEnabled}
                                         disabled={isDisabled}
                                         onCheckedChange={() => handleToggleAction(moduleName, action.key, isEnabled)}
                                      />
                                    </div>
                                  </TableCell>
                                );
                              })}
                            </TableRow>

                            {/* Sub Modules Rows */}
                            {hasSubModules && isExpanded && isViewEnabled && subModules.map((sm: string) => {
                               const subPerm = getPermission(sm);
                               const subIsViewEnabled = subPerm ? subPerm.actions.view : true;

                               return (
                                 <TableRow key={`${moduleName}-${sm}`} className="bg-muted/5 hover:bg-muted/20">
                                   <TableCell className="pl-12 text-sm text-muted-foreground">
                                      {sm}
                                   </TableCell>
                                   {PERMISSION_ACTIONS.map((action) => {
                                      const isEnabled = subPerm ? subPerm.actions[action.key] : true;
                                      const isDisabled = action.key !== 'view' && !subIsViewEnabled;
                                      
                                      return (
                                        <TableCell key={action.key} className="text-center">
                                          <div className="flex justify-center scale-90">
                                            <Switch 
                                               checked={isEnabled}
                                               disabled={isDisabled}
                                               onCheckedChange={() => handleToggleAction(sm, action.key, isEnabled)}
                                            />
                                          </div>
                                        </TableCell>
                                      );
                                   })}
                                 </TableRow>
                               );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="scope" className="flex-1 mt-6 border rounded-lg overflow-hidden m-1">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="w-[300px]">Enabled Module</TableHead>
                  <TableHead className="w-[300px]">Field Visibility</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemModules.flatMap((g: any) => g.items).flatMap((item: any) => {
                    const moduleName = typeof item === 'string' ? item : item.name;
                    const subModules = item.subModules || [];
                    return [moduleName, ...subModules];
                }).filter(moduleName => {
                      const p = getPermission(moduleName);
                      return p ? p.actions.view : true; 
                  }).map((moduleName) => {
                    const perm = getPermission(moduleName);
                    const fieldCount = perm && perm.fieldScope ? Object.keys(perm.fieldScope).length : 0;
                    const hiddenCount = perm && perm.fieldScope ? Object.values(perm.fieldScope).filter(v => !v).length : 0;
                    
                    return (
                        <TableRow key={moduleName} className="hover:bg-muted/50">
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    {moduleName}
                                </div>
                            </TableCell>
                            <TableCell>
                                {hiddenCount > 0 ? (
                                    <span className="text-amber-600 font-medium">{hiddenCount} fields hidden</span>
                                ) : (
                                    <span className="text-muted-foreground">All fields visible</span>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                        setSelectedModule(moduleName);
                                        // Open field config (using the same selectedModule state, but distinct view logic)
                                    }}
                                >
                                    Manage Fields
                                </Button>
                            </TableCell>
                        </TableRow>
                    );
                })}
              </TableBody>
            </Table>

            {/* Field Configuration Area (Conditionally Rendered or in Dialog - simplistic inline approach for now) */}
            {selectedModule && (
                 <Dialog open={!!selectedModule} onOpenChange={(open) => !open && setSelectedModule("")}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Field Security: {selectedModule}</DialogTitle>
                            <DialogDescription>
                                Toggle visibility of specific fields for this role.
                            </DialogDescription>
                        </DialogHeader>
                        
                        <div className="py-4">
                            {/* Mock Fields for demo */}
                            {['Users', 'Employees', 'Products', 'Suppliers'].includes(selectedModule) ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Field Name</TableHead>
                                            <TableHead className="text-right">Visible</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(MODULE_FIELDS[selectedModule] || []).map(field => {
                                            // Mocking the field key for storage
                                            const fieldKey = field.toLowerCase().replace(/\s+/g, '_');
                                            const perm = getPermission(selectedModule);
                                            // Default to true if not in map
                                            const isVisible = perm?.fieldScope?.[fieldKey] !== false;

                                            return (
                                                <TableRow key={field}>
                                                    <TableCell>{field}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Switch 
                                                            checked={isVisible}
                                                            onCheckedChange={(checked) => {
                                                                setRole((prev: any) => {
                                                                    const newPermissions = [...prev.permissions];
                                                                    const idx = newPermissions.findIndex((p: any) => p.module === selectedModule);
                                                                    if (idx >= 0) {
                                                                        const currentScope = newPermissions[idx].fieldScope || {};
                                                                        // Update: we check !checked because we store 'true' for visible? 
                                                                        // Actually in Schema it's Map of Boolean. Let's store direct boolean.
                                                                        // If checked (true), we store true? Or remove from map?
                                                                        // Let's store explicit value.
                                                                        const newScope = { ...currentScope, [fieldKey]: checked };
                                                                        newPermissions[idx] = { ...newPermissions[idx], fieldScope: newScope };
                                                                    }
                                                                    return { ...prev, permissions: newPermissions };
                                                                });
                                                            }}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                    <Shield className="h-10 w-10 mb-2 opacity-20" />
                                    <p>No configurable fields available for this module yet.</p>
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button onClick={() => setSelectedModule("")}>Done</Button>
                        </DialogFooter>
                    </DialogContent>
                 </Dialog>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
