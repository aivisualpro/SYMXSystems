
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
import { ArrowLeft, Save, Loader2, CheckCircle2, Shield, AlertTriangle, Search } from "lucide-react";
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

// Define the Modules structure based on the Sidebar
const SYSTEM_MODULES = [
  { group: "Admin", items: ["Dashboard", "Users", "Employees", "Suppliers", "Notifications", "Settings"] },
  { group: "Inventory", items: ["Warehouse", "Categories", "Products", "Release Requests"] },
  { group: "Management", items: ["Purchase Orders", "Quality Control"] },
  { group: "Reports", items: ["Andres Tracker", "Live Shipments"] },
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
  Suppliers: ["VB ID", "Name", "Locations", "FDA Registration"],
  Warehouse: ["Name", "Address", "Contacts"],
  Categories: ["Category Name", "Subcategories", "Is On Website"],
  Products: ["VB ID", "Name", "Description", "Category", "Subcategory", "Cost Price", "Sale Price", "Tags", "Cover Image", "Primary Image", "Show Case", "Other Info", "Is On Website", "Serial No"],
  "Release Requests": ["PO Number", "Date", "Warehouse", "Requested By", "Customer", "Contact", "Products", "Carrier", "Pickup Time", "Instructions", "Created By"],
  "Purchase Orders": ["VB PO Number", "Order Type", "Date", "Category", "Created By", "Customer PO List", "Shipping Details"],
  "Quality Control": ["Inspection Date", "Inspector", "Status", "Comments", "Result", "Attachments"],
  "Andres Tracker": ["Tracker ID", "Date", "Status", "Notes", "Assigned To"],
  "Live Shipments": ["Tracking Number", "Carrier", "Status", "ETA", "Vessel Name", "Port of Lading", "Port of Entry"],
  Dashboard: ["Overview Stats", "Recent Activity", "Performance Charts", "Notifications Preview"],
  Settings: ["General Settings", "Roles Management", "Import/Export", "System Config"],
  Notifications: ["Email Alerts", "System Notifications", "Push Notifications"]
};

export default function RoleDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const roleId = params.id as string;

  const [role, setRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string>("");

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
                {SYSTEM_MODULES.map((group) => {
                  // Filter items based on search query
                  const filteredItems = group.items.filter(item => 
                    item.toLowerCase().includes(searchQuery.toLowerCase())
                  );

                  if (filteredItems.length === 0) return null;

                  return (
                  <React.Fragment key={group.group}>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={7} className="font-semibold text-xs text-muted-foreground py-2 uppercase tracking-wider pl-4">
                        {group.group}
                      </TableCell>
                    </TableRow>
                    {filteredItems.map((moduleName) => {
                       // Helper to access checking logic efficiently
                       const perm = getPermission(moduleName);
                       
                       return (
                        <TableRow key={moduleName} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{moduleName}</TableCell>
                          {PERMISSION_ACTIONS.map((action) => {
                             const isEnabled = perm ? perm.actions[action.key] : true;
                             // Check if view is enabled (default to true if perm missing, matching previous logic)
                             const isViewEnabled = perm ? perm.actions.view : true;
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
                       );
                    })}
                  </React.Fragment>
                )})}
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
                {SYSTEM_MODULES.flatMap(g => g.items).filter(item => {
                      const p = getPermission(item);
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
