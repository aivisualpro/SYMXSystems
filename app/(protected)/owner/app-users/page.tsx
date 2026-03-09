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

/* ── Role badge styles ──────────────────────────────────────────── */
function getRoleBadge(role: string) {
  switch (role) {
    case "Super Admin":
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    case "Admin":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "Manager":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    case "Dispatch":
      return "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20";
    default:
      return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
  }
}

/* ── Page ────────────────────────────────────────────────────────── */
export default function AppUsersPage() {
  const { users, loadingUsers, search, fetchUsers, addUserOpen, setAddUserOpen } = useOwner();

  const [editingItem, setEditingItem] = useState<User | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);

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
      if (viewUser && editingItem && viewUser._id === editingItem._id) {
        fetchUserDetail(editingItem._id);
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
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (res.ok) {
        const data = await res.json();
        setViewUser(data);
      }
    } catch {
      toast.error("Failed to load user details");
    }
  };

  const openUserDetail = (user: User) => {
    setViewUser(user);
    fetchUserDetail(user._id);
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

  /* ── Skeleton ──────────────────────────────────────────── */
  if (loadingUsers) return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card p-6 animate-pulse flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-muted mb-3" />
            <div className="h-3.5 bg-muted rounded w-24 mb-2" />
            <div className="h-2.5 bg-muted rounded w-16 mb-3" />
            <div className="h-2.5 bg-muted rounded w-36 mb-4" />
            <div className="h-5 bg-muted rounded-full w-14" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="h-full overflow-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUsers.map((user: any) => {
            const initials = (user.name || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

            return (
              <div
                key={user._id}
                className="group relative rounded-xl border border-border/50 bg-card overflow-hidden transition-all duration-200 hover:shadow-md hover:border-border cursor-pointer"
                onClick={() => openUserDetail(user)}
              >
                {/* Action buttons - top right on hover */}
                <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={(e) => openEditSheet(user, e)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                    title="Edit"
                  >
                    <IconEdit size={14} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(user._id, e)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Delete"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>

                <div className="p-5 flex flex-col items-center text-center">
                  {/* Avatar */}
                  <div className="w-16 h-16 rounded-full bg-muted overflow-hidden border-2 border-border/40 mb-3 flex-shrink-0">
                    {user.profilePicture ? (
                      <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground/60">
                        {initials}
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <h3 className="text-sm font-bold text-foreground truncate max-w-full leading-tight">
                    {user.name || "Unnamed"}
                  </h3>

                  {/* Role */}
                  <p className="text-xs text-muted-foreground mt-0.5">{user.AppRole || "—"}</p>

                  {/* Email */}
                  <p className="text-[11px] text-muted-foreground/70 truncate max-w-full mt-1.5">
                    {user.email}
                  </p>

                  {/* Status */}
                  <div className="flex items-center gap-1.5 mt-3">
                    <div className={`w-2 h-2 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                    <span className={`text-[11px] font-semibold ${user.isActive ? "text-emerald-500" : "text-muted-foreground/50"}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Role badge */}
                  <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/40">
                    <IconShieldCheck size={11} className="text-muted-foreground/50" />
                    <span className="text-[10px] text-muted-foreground font-medium">{user.AppRole}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredUsers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center border border-border/30">
              <IconUsers size={28} className="text-muted-foreground/30" />
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
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl bg-card shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{viewUser?.name || "User Details"}</DialogTitle>
          </DialogHeader>

          {viewUser && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              {/* Hero */}
              <div className="relative px-8 pt-8 pb-6 flex flex-col items-center text-center border-b border-border/40">
                {/* Subtle gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />

                {/* Avatar */}
                <div className="relative w-20 h-20 rounded-full bg-muted overflow-hidden border-2 border-border/40 mb-3 z-10">
                  {viewUser.profilePicture ? (
                    <img src={viewUser.profilePicture} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground/50">
                      {(viewUser.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <h2 className="text-xl font-extrabold text-foreground tracking-tight relative z-10">{viewUser.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5 relative z-10">{viewUser.AppRole}</p>

                <div className="flex items-center gap-2 mt-3 relative z-10">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${getRoleBadge(viewUser.AppRole)}`}>
                    <IconShieldCheck size={11} />
                    {viewUser.AppRole}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${viewUser.isActive ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-border bg-muted text-muted-foreground"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${viewUser.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                    {viewUser.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Edit button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5 rounded-lg text-xs relative z-10"
                  onClick={() => openEditSheet(viewUser)}
                >
                  <IconPencil size={12} /> Edit Profile
                </Button>
              </div>

              {/* Details */}
              <div className="px-8 py-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <DetailCard icon={<IconMail size={13} />} label="Email" value={viewUser.email} />
                  <DetailCard icon={<IconPhone size={13} />} label="Phone" value={viewUser.phone} />
                  <DetailCard icon={<IconMapPin size={13} />} label="Address" value={viewUser.address} />
                  <DetailCard icon={<IconMapPin size={13} />} label="Location" value={viewUser.location} />
                </div>

                {/* Signature */}
                <div className="rounded-lg border border-border/50 p-4">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5 mb-2">
                    <IconSignature size={12} className="text-muted-foreground/50" /> Signature
                  </p>
                  {viewUser.signature ? (
                    <div className="bg-muted/50 rounded-lg flex items-center justify-center p-3 min-h-[70px]">
                      <img src={viewUser.signature} alt="Signature" className="h-full w-auto max-h-[60px] object-contain dark:invert dark:brightness-200" />
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-lg flex items-center justify-center p-3 min-h-[50px] border border-dashed border-border">
                      <p className="text-muted-foreground/40 text-xs italic">No signature on file</p>
                    </div>
                  )}
                </div>

                {/* Password */}
                <div className="rounded-lg border border-border/50 p-4">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5 mb-2.5">
                    <IconLock size={12} className="text-muted-foreground/50" /> Change Password
                  </p>
                  <div className="flex gap-2.5 items-center">
                    <div className="flex-1 relative">
                      <IconLock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30" />
                      <input
                        type="text"
                        placeholder="New password"
                        id="detail-password-input"
                        className="w-full bg-muted/50 border border-border rounded-lg py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="h-9 px-4 rounded-lg text-xs font-semibold"
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

/* ── Reusable Detail Card ────────────────────────────────────────── */
function DetailCard({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="rounded-lg border border-border/50 p-3.5">
      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5 mb-1">
        <span className="text-muted-foreground/50">{icon}</span> {label}
      </p>
      <p className="text-sm font-medium text-foreground truncate">
        {value || <span className="text-muted-foreground/40 italic font-normal">Not provided</span>}
      </p>
    </div>
  );
}
