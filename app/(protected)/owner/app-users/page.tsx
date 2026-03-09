"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOwner } from "../layout";
import { UserForm } from "@/components/admin/user-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  IconEdit, IconTrash, IconEye, IconMail, IconPhone,
  IconUser, IconUsers, IconMapPin, IconShieldCheck,
  IconDotsVertical,
} from "@tabler/icons-react";

/* ── Types ──────────────────────────────────────────────────────── */
interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  AppRole: string;
  password?: string;
  isActive: boolean;
  serialNo?: string;
  designation?: string;
  bioDescription?: string;
  profilePicture?: string;
  signature?: string;
  isOnWebsite?: boolean;
  location?: string;
}

/* ── Role color map ─────────────────────────────────────────────── */
function getRoleStyle(role: string) {
  switch (role) {
    case "Super Admin":
      return "bg-gradient-to-r from-red-500/10 to-orange-500/10 text-red-500 border-red-500/20";
    case "Admin":
      return "bg-gradient-to-r from-amber-500/10 to-yellow-500/10 text-amber-500 border-amber-500/20";
    case "Manager":
      return "bg-gradient-to-r from-blue-500/10 to-cyan-500/10 text-blue-500 border-blue-500/20";
    default:
      return "bg-gradient-to-r from-slate-500/10 to-gray-500/10 text-slate-500 border-slate-500/20";
  }
}

/* ── Page ────────────────────────────────────────────────────────── */
export default function AppUsersPage() {
  const { users, loadingUsers, search, fetchUsers, addUserOpen, setAddUserOpen } = useOwner();
  const router = useRouter();

  const [editingItem, setEditingItem] = useState<User | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  /* ── CRUD ──────────────────────────────────────────────── */
  const handleSubmit = async (formData: Partial<User>) => {
    try {
      const url = editingItem ? `/api/admin/users/${editingItem._id}` : "/api/admin/users";
      const method = editingItem ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(editingItem ? "User updated" : "User created");
      setAddUserOpen(false);
      setEditingItem(null);
      fetchUsers();
    } catch {
      toast.error("Failed to save user");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("User deleted");
      fetchUsers();
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const handleToggleActive = useCallback(async (userId: string, checked: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: checked }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`User ${checked ? "activated" : "deactivated"}`);
      fetchUsers();
    } catch {
      toast.error("Failed to update status");
      fetchUsers();
    }
  }, [fetchUsers]);

  const openEditSheet = async (item: User) => {
    setEditingItem(item);
    setAddUserOpen(true);
    try {
      const res = await fetch(`/api/admin/users/${item._id}`);
      if (res.ok) {
        const detailed = await res.json();
        setEditingItem(detailed);
      }
    } catch { }
  };

  /* ── Filter ────────────────────────────────────────────── */
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u: any) =>
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q) ||
      (u.designation || "").toLowerCase().includes(q) ||
      (u.AppRole || "").toLowerCase().includes(q) ||
      (u.serialNo || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  /* ── Loading skeleton ──────────────────────────────────── */
  if (loadingUsers) return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/40 bg-card p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-muted rounded-lg w-3/4" />
                <div className="h-2.5 bg-muted rounded-lg w-1/2" />
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="h-2.5 bg-muted rounded-lg w-full" />
              <div className="h-2.5 bg-muted rounded-lg w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="h-full overflow-auto p-4 sm:p-6">
        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUsers.map((user: any) => {
            const isMenuOpen = openMenuId === user._id;

            return (
              <div
                key={user._id}
                className="group relative rounded-2xl border border-border/40 bg-card overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 cursor-pointer"
                onClick={() => router.push(`/owner/app-users/${user._id}`)}
              >
                {/* Top gradient bar */}
                <div className={`h-1 w-full ${user.isActive
                  ? "bg-gradient-to-r from-emerald-400 via-primary to-blue-500"
                  : "bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700"
                  }`} />

                {/* Card content */}
                <div className="p-4 sm:p-5">
                  {/* Header: Avatar + Info + Actions */}
                  <div className="flex items-start gap-3 mb-4">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-muted to-muted/60 overflow-hidden border-2 border-border/30 shadow-sm">
                        {user.profilePicture ? (
                          <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <IconUser size={20} className="text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      {/* Online indicator */}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card ${user.isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                    </div>

                    {/* Name + Designation */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate leading-tight">
                        {user.name || "Unnamed"}
                      </h3>
                    </div>

                    {/* Actions menu */}
                    <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenMenuId(isMenuOpen ? null : user._id)}
                        className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <IconDotsVertical size={14} />
                      </button>
                      {isMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-8 z-50 w-36 rounded-xl border border-border bg-card shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                            <button
                              onClick={() => { setOpenMenuId(null); router.push(`/owner/app-users/${user._id}`); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-foreground hover:bg-muted/60 transition-colors"
                            >
                              <IconEye size={13} /> View Profile
                            </button>
                            <button
                              onClick={() => { setOpenMenuId(null); openEditSheet(user); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-foreground hover:bg-muted/60 transition-colors"
                            >
                              <IconEdit size={13} /> Edit
                            </button>
                            <div className="h-px bg-border/50 my-1" />
                            <button
                              onClick={() => { setOpenMenuId(null); handleDelete(user._id); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-500 hover:bg-red-500/5 transition-colors"
                            >
                              <IconTrash size={13} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Role Badge */}
                  <div className="mb-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${getRoleStyle(user.AppRole)}`}>
                      <IconShieldCheck size={11} />
                      {user.AppRole || "No Role"}
                    </span>
                  </div>

                  {/* Contact details */}
                  <div className="space-y-1.5">
                    {user.email && (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground group/link"
                        onClick={e => { e.stopPropagation(); window.location.href = `mailto:${user.email}`; }}>
                        <IconMail size={12} className="text-muted-foreground/40 flex-shrink-0" />
                        <span className="truncate hover:text-primary transition-colors">{user.email}</span>
                      </div>
                    )}
                    {user.phone && (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <IconPhone size={12} className="text-muted-foreground/40 flex-shrink-0" />
                        <span className="truncate">{user.phone}</span>
                      </div>
                    )}
                    {user.location && (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <IconMapPin size={12} className="text-muted-foreground/40 flex-shrink-0" />
                        <span className="truncate">{user.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer: Status toggle */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30" onClick={e => e.stopPropagation()}>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${user.isActive ? "text-emerald-500" : "text-muted-foreground/40"}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                    <Switch
                      checked={user.isActive}
                      onCheckedChange={(checked) => handleToggleActive(user._id, checked)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredUsers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center border border-primary/10">
              <IconUsers size={28} className="text-primary/30" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground/80">
                {search.trim() ? "No users found" : "No users yet"}
              </p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                {search.trim() ? "Try adjusting your search terms." : "Click \"Add User\" to get started."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit User Dialog */}
      <Dialog open={addUserOpen} onOpenChange={(open) => { setAddUserOpen(open); if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <UserForm
            initialData={editingItem || {}}
            onSubmit={handleSubmit}
            onCancel={() => { setAddUserOpen(false); setEditingItem(null); }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
