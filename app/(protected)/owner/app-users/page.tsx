"use client";

import { useState, useMemo, useCallback } from "react";
import { useOwner } from "../layout";
import { UserForm } from "@/components/admin/user-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  IconEdit, IconTrash, IconMail, IconPhone,
  IconUser, IconUsers, IconMapPin, IconShieldCheck,
  IconPencil, IconLock, IconSignature,
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
  profilePicture?: string;
  signature?: string;
  location?: string;
}

/* ── Role styles ────────────────────────────────────────────────── */
function getRoleStyle(role: string) {
  switch (role) {
    case "Super Admin":
      return { bg: "bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-600 dark:text-red-400 border-red-500/30", dot: "bg-red-500" };
    case "Admin":
      return { bg: "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30", dot: "bg-amber-500" };
    case "Manager":
      return { bg: "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30", dot: "bg-blue-500" };
    default:
      return { bg: "bg-gradient-to-r from-slate-500/20 to-gray-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30", dot: "bg-slate-500" };
  }
}

/* ── Page ────────────────────────────────────────────────────────── */
export default function AppUsersPage() {
  const { users, loadingUsers, search, fetchUsers, addUserOpen, setAddUserOpen } = useOwner();

  const [editingItem, setEditingItem] = useState<User | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

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
      // Refresh view popup if open
      if (viewUser && editingItem && viewUser._id === editingItem._id) {
        const updated = await res.json().catch(() => null);
        if (updated) setViewUser(updated);
        else fetchUserDetail(editingItem._id);
      }
    } catch {
      toast.error("Failed to save user");
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("User deleted");
      if (viewUser?._id === id) setViewUser(null);
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
      if (viewUser?._id === userId) setViewUser(prev => prev ? { ...prev, isActive: checked } : null);
    } catch {
      toast.error("Failed to update status");
      fetchUsers();
    }
  }, [fetchUsers, viewUser]);

  const openEditSheet = async (item: User, e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  const fetchUserDetail = async (id: string) => {
    setViewLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (res.ok) {
        const data = await res.json();
        setViewUser(data);
      }
    } catch {
      toast.error("Failed to load user details");
    } finally {
      setViewLoading(false);
    }
  };

  const openUserDetail = (user: User) => {
    setViewUser(user); // Show immediately with list data
    fetchUserDetail(user._id); // Then fetch full details
  };

  /* ── Filter ────────────────────────────────────────────── */
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u: any) =>
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q) ||
      (u.AppRole || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  /* ── Skeleton loading ──────────────────────────────────── */
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

  const roleStyle = (role: string) => getRoleStyle(role);

  return (
    <>
      <div className="h-full overflow-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUsers.map((user: any) => {
            const rs = roleStyle(user.AppRole);
            return (
              <div
                key={user._id}
                className="group relative rounded-2xl border border-border/40 bg-card overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 cursor-pointer"
                onClick={() => openUserDetail(user)}
              >
                {/* Top gradient bar */}
                <div className={`h-1 w-full ${user.isActive
                  ? "bg-gradient-to-r from-emerald-400 via-primary to-blue-500"
                  : "bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700"
                  }`} />

                <div className="p-4 sm:p-5">
                  {/* Header: Avatar + Name + Inline buttons */}
                  <div className="flex items-start gap-3 mb-3">
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
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0 pt-1">
                      <h3 className="text-sm font-bold text-foreground truncate leading-tight">
                        {user.name || "Unnamed"}
                      </h3>
                      <p className="text-[11px] text-foreground/70 truncate mt-0.5">{user.email}</p>
                    </div>

                    {/* Action buttons - always visible */}
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => openEditSheet(user, e)}
                        className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-blue-500 hover:bg-blue-500/10 transition-all duration-200 opacity-0 group-hover:opacity-100"
                        title="Edit"
                      >
                        <IconEdit size={14} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(user._id, e)}
                        className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <div className="mb-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${rs.bg}`}>
                      <IconShieldCheck size={11} />
                      {user.AppRole || "No Role"}
                    </span>
                  </div>

                  {/* Contact details */}
                  <div className="space-y-1.5">
                    {user.phone && (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <IconPhone size={12} className="text-muted-foreground/40 flex-shrink-0" />
                        <span className="truncate">{user.phone}</span>
                      </div>
                    )}
                    {user.location && (
                      <div className="flex items-center gap-2 text-[11px] text-foreground/70">
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

      {/* ── User Detail Popup ───────────────────────────────────── */}
      <Dialog open={!!viewUser} onOpenChange={(open) => { if (!open) setViewUser(null); }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-3xl bg-card shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{viewUser?.name || "User Details"}</DialogTitle>
          </DialogHeader>

          {viewUser && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              {/* Hero section */}
              <div className="relative">
                {/* Gradient backdrop */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-blue-500/5" />
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-card to-transparent" />

                <div className="relative px-8 pt-8 pb-6 flex items-end gap-5">
                  {/* Large avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-24 h-24 rounded-2xl bg-muted overflow-hidden border-2 border-border shadow-2xl">
                      {viewUser.profilePicture ? (
                        <img src={viewUser.profilePicture} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <IconUser size={36} className="text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-3 border-card ${viewUser.isActive ? "bg-emerald-500 shadow-lg shadow-emerald-500/30" : "bg-gray-500"}`} />
                  </div>

                  {/* Name + role + edit button */}
                  <div className="flex-1 min-w-0 pb-1">
                    <h2 className="text-2xl font-extrabold text-foreground truncate tracking-tight">{viewUser.name}</h2>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${getRoleStyle(viewUser.AppRole).bg}`}>
                        <IconShieldCheck size={10} />
                        {viewUser.AppRole}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${viewUser.isActive ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500" : "border-border bg-muted text-muted-foreground"}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${viewUser.isActive ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-muted-foreground/40"}`} />
                        {viewUser.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5 rounded-xl border border-border"
                    onClick={() => openEditSheet(viewUser)}
                  >
                    <IconPencil size={13} /> Edit
                  </Button>
                </div>
              </div>

              {/* Details grid */}
              <div className="px-8 pb-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  {/* Email */}
                  <div className="bg-muted/50 rounded-xl border border-border/60 p-4 hover:bg-muted/70 transition-colors">
                    <p className="text-muted-foreground text-[9px] uppercase font-bold tracking-[0.15em] flex items-center gap-1.5 mb-1.5">
                      <IconMail size={11} className="text-primary/60" /> Email
                    </p>
                    <p className="text-foreground text-sm font-medium break-all leading-relaxed">{viewUser.email}</p>
                  </div>

                  {/* Phone */}
                  <div className="bg-muted/50 rounded-xl border border-border/60 p-4 hover:bg-muted/70 transition-colors">
                    <p className="text-muted-foreground text-[9px] uppercase font-bold tracking-[0.15em] flex items-center gap-1.5 mb-1.5">
                      <IconPhone size={11} className="text-primary/60" /> Phone
                    </p>
                    <p className="text-foreground text-sm font-medium">{viewUser.phone || <span className="text-muted-foreground/50 italic">Not provided</span>}</p>
                  </div>

                  {/* Address */}
                  <div className="bg-muted/50 rounded-xl border border-border/60 p-4 hover:bg-muted/70 transition-colors">
                    <p className="text-muted-foreground text-[9px] uppercase font-bold tracking-[0.15em] flex items-center gap-1.5 mb-1.5">
                      <IconMapPin size={11} className="text-primary/60" /> Address
                    </p>
                    <p className="text-foreground text-sm font-medium">{viewUser.address || <span className="text-muted-foreground/50 italic">Not provided</span>}</p>
                  </div>

                  {/* Location */}
                  <div className="bg-muted/50 rounded-xl border border-border/60 p-4 hover:bg-muted/70 transition-colors">
                    <p className="text-muted-foreground text-[9px] uppercase font-bold tracking-[0.15em] flex items-center gap-1.5 mb-1.5">
                      <IconMapPin size={11} className="text-primary/60" /> Location
                    </p>
                    <p className="text-foreground text-sm font-medium">{viewUser.location || <span className="text-muted-foreground/50 italic">Not provided</span>}</p>
                  </div>
                </div>

                {/* Signature */}
                <div className="bg-muted/50 rounded-xl border border-border/60 p-4 hover:bg-muted/70 transition-colors">
                  <p className="text-muted-foreground text-[9px] uppercase font-bold tracking-[0.15em] flex items-center gap-1.5 mb-2">
                    <IconSignature size={11} className="text-primary/60" /> Signature
                  </p>
                  {viewUser.signature ? (
                    <div className="bg-muted rounded-lg flex items-center justify-center p-3 min-h-[80px] border border-border/40">
                      <img src={viewUser.signature} alt="Signature" className="h-full w-auto max-h-[70px] object-contain dark:invert dark:brightness-200" />
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-lg flex items-center justify-center p-3 min-h-[60px] border border-dashed border-border">
                      <p className="text-muted-foreground/50 text-xs italic">No signature on file</p>
                    </div>
                  )}
                </div>

                {/* Password change */}
                <div className="bg-muted/50 rounded-xl border border-border/60 p-4">
                  <p className="text-muted-foreground text-[9px] uppercase font-bold tracking-[0.15em] flex items-center gap-1.5 mb-3">
                    <IconLock size={11} className="text-primary/60" /> Account Security
                  </p>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <div className="relative">
                        <IconLock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                        <input
                          type="text"
                          placeholder="Enter new password"
                          id="detail-password-input"
                          className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-wider h-10 px-5 rounded-xl transition-all shadow-lg shadow-primary/10 active:scale-95 whitespace-nowrap"
                      onClick={async () => {
                        const input = document.getElementById("detail-password-input") as HTMLInputElement;
                        const newPassword = input.value;
                        if (!newPassword) { toast.error("Please enter a new password"); return; }
                        try {
                          const res = await fetch("/api/auth/change-password", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: viewUser._id, newPassword }),
                          });
                          if (!res.ok) throw new Error("Failed");
                          toast.success("Password updated");
                          input.value = "";
                        } catch { toast.error("Failed to update password"); }
                      }}
                    >
                      Update
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit User Dialog ─────────────────────────────── */}
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
