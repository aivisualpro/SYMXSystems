
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, Plus, Pencil, Trash, User, Loader2, Search } from "lucide-react";
import { SettingsPageSkeleton } from "@/components/skeletons";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useRouter } from "next/navigation";

interface Role {
  _id: string;
  name: string;
  description?: string;
  createdAt: string;
  userCount: number;
}

export default function RolesSettingsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setRightContent } = useHeaderActions();
  const router = useRouter();

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/roles");
      if (!res.ok) throw new Error("Failed to fetch roles");
      const data = await res.json();
      setRoles(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName,
          description: newRoleDesc,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create role");
      }

      toast.success("Role created successfully");
      setNewRoleName("");
      setNewRoleDesc("");
      setIsCreateOpen(false);
      fetchRoles();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  // ... fetchRoles ...

  // handleCreateRole ...

  const handleDeleteClick = (e: React.MouseEvent, role: Role) => {
    e.stopPropagation(); // Prevent card click
    
    if (role.userCount > 0) {
      toast.error(`Cannot delete role. It has ${role.userCount} active users.`);
      return;
    }

    setRoleToDelete(role);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!roleToDelete) return;

    try {
      const res = await fetch(`/api/admin/roles/${roleToDelete._id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete role");

      toast.success("Role deleted successfully");
      fetchRoles();
    } catch (error) {
       console.error(error);
       toast.error("Failed to delete role");
    } finally {
        setIsDeleteAlertOpen(false);
        setRoleToDelete(null);
    }
  };

  // ... useEffects ...

  return (
    <div className="space-y-6 pt-2">
      {/* ... Dialog ... */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
           <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Add a new role identifier.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRole}>
             {/* ... form content ... (keep existing) */}
             <div className="grid gap-4 py-4">
               <div className="grid gap-2">
                 <Label htmlFor="name">Role Name</Label>
                 <Input
                   id="name"
                   value={newRoleName}
                   onChange={(e) => setNewRoleName(e.target.value)}
                   placeholder="e.g. Sales Rep"
                   required
                 />
               </div>
               <div className="grid gap-2">
                 <Label htmlFor="description">Description (Optional)</Label>
                 <Input
                   id="description"
                   value={newRoleDesc}
                   onChange={(e) => setNewRoleDesc(e.target.value)}
                   placeholder="Brief description of the role functionality"
                 />
               </div>
             </div>
             <DialogFooter>
               <Button type="submit" disabled={isSubmitting}>
                 {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 Create Role
               </Button>
             </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* ... list logic ... */}
      {loading ? (
        <SettingsPageSkeleton />
      ) : roles.length === 0 ? (
         <div className="flex flex-col items-center justify-center space-y-4 py-20 text-center border-2 border-dashed rounded-xl bg-muted/30">
            {/* ... empty state ... */}
             <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                 <Shield className="h-8 w-8 text-muted-foreground" />
             </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">No roles found</h3>
              <p className="text-muted-foreground">Add a new role to manage user permissions.</p>
            </div>
         </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {roles.map((role) => (
            <Card 
              key={role._id} 
              className="group relative overflow-hidden transition-all hover:shadow-lg border-0 bg-gradient-to-br from-card to-muted/50 cursor-pointer"
              onClick={() => router.push(`/admin/settings/roles/${role._id}`)}
              >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              
              <div className="absolute top-2 right-2 z-10">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => handleDeleteClick(e, role)}
                 >
                    <Trash className="h-4 w-4" />
                 </Button>
              </div>

              <CardHeader className="pb-2 pt-6">
                <CardTitle className="text-lg font-bold">{role.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 min-h-[40px] mb-4">
                  {role.description || "No description provided."}
                </p>
                <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs">
                        {role.userCount}
                    </span>
                    <span className="text-muted-foreground">
                        {role.userCount === 1 ? 'User' : 'Users'} Assigned
                    </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the 
              <span className="font-semibold text-foreground"> "{roleToDelete?.name}" </span>
              role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
