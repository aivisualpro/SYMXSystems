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
  IconEdit, IconTrash, IconEye, IconArrowUp, IconArrowDown,
  IconArrowsSort, IconMail, IconPhone, IconUser, IconUsers,
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

/* ── Helpers ────────────────────────────────────────────────────── */
type SortDir = "asc" | "desc" | null;

/* ── Page ────────────────────────────────────────────────────────── */
export default function AppUsersPage() {
  const { users, loadingUsers, search, fetchUsers, addUserOpen, setAddUserOpen } = useOwner();
  const router = useRouter();

  const [editingItem, setEditingItem] = useState<User | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
      else setSortDir("asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  /* ── CRUD ────────────────────────────────────────────────── */
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

  /* ── Sort + Search ──────────────────────────────────────── */
  const sortedUsers = useMemo(() => {
    let list = [...users];
    if (sortKey && sortDir) {
      list.sort((a: any, b: any) => {
        let aVal = a[sortKey] ?? "";
        let bVal = b[sortKey] ?? "";
        if (typeof aVal === "boolean") { aVal = aVal ? 1 : 0; bVal = bVal ? 1 : 0; }
        if (typeof aVal === "number" && typeof bVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        aVal = aVal.toString().toLowerCase();
        bVal = bVal.toString().toLowerCase();
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [users, sortKey, sortDir]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return sortedUsers;
    const q = search.toLowerCase();
    return sortedUsers.filter((u: any) =>
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q) ||
      (u.designation || "").toLowerCase().includes(q) ||
      (u.AppRole || "").toLowerCase().includes(q) ||
      (u.serialNo || "").toLowerCase().includes(q)
    );
  }, [sortedUsers, search]);

  /* ── Column config ──────────────────────────────────────── */
  const columns = [
    { key: "profilePicture", label: "", sortable: false, width: "w-14" },
    { key: "serialNo", label: "#", sortable: true, width: "w-12" },
    { key: "name", label: "Name", sortable: true },
    { key: "designation", label: "Designation", sortable: true },
    { key: "AppRole", label: "Role", sortable: true },
    { key: "email", label: "", sortable: false, width: "w-10" },
    { key: "phone", label: "", sortable: false, width: "w-10" },
    { key: "isActive", label: "Status", sortable: true, width: "w-20" },
  ];

  if (loadingUsers) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground/50">Loading users…</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Table */}
      <div className="h-full overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20">
            <tr className="bg-card/95 backdrop-blur-sm border-b border-border/80">
              {columns.map((col) => {
                const isActive = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    className={`
                      px-3 py-3 text-left text-[10px] font-bold uppercase tracking-widest
                      whitespace-nowrap select-none transition-colors ${col.width || ""}
                      ${col.sortable ? "cursor-pointer hover:text-foreground hover:bg-muted/60 group/th" : ""}
                      ${isActive ? "text-primary bg-primary/5" : "text-muted-foreground/70"}
                    `}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        <span className={`transition-colors ${isActive ? "text-primary" : "text-muted-foreground/30 group-hover/th:text-muted-foreground/60"}`}>
                          {isActive && sortDir === "asc" ? <IconArrowUp size={11} />
                            : isActive && sortDir === "desc" ? <IconArrowDown size={11} />
                              : <IconArrowsSort size={11} />}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="px-3 py-3 w-28" />
            </tr>
            <tr>
              <td colSpan={columns.length + 1} className="p-0">
                <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
              </td>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/40">
            {filteredUsers.map((user: any, idx: number) => (
              <tr
                key={user._id}
                className={`
                  relative group cursor-pointer transition-all duration-150
                  hover:bg-primary/[0.035] hover:shadow-[inset_3px_0_0_hsl(var(--primary))]
                  ${idx % 2 === 0 ? "bg-transparent" : "bg-muted/[0.015]"}
                `}
                onClick={() => router.push(`/owner/app-users/${user._id}`)}
              >
                {/* Avatar */}
                <td className="px-3 py-2">
                  <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex items-center justify-center border border-border/40">
                    {user.profilePicture ? (
                      <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <IconUser size={16} className="text-muted-foreground/40" />
                    )}
                  </div>
                </td>
                {/* Serial */}
                <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{user.serialNo || "—"}</td>
                {/* Name */}
                <td className="px-3 py-2 text-xs font-medium text-foreground">{user.name || "—"}</td>
                {/* Designation */}
                <td className="px-3 py-2 text-xs text-muted-foreground">{user.designation || "—"}</td>
                {/* Role */}
                <td className="px-3 py-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${user.AppRole === "Super Admin"
                      ? "bg-red-500/10 text-red-500 border border-red-500/20"
                      : user.AppRole === "Admin"
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                    }`}>
                    {user.AppRole || "—"}
                  </span>
                </td>
                {/* Email icon */}
                <td className="px-3 py-2 text-center" title={user.email}>
                  <IconMail size={14} className="text-muted-foreground/50 mx-auto" />
                </td>
                {/* Phone icon */}
                <td className="px-3 py-2 text-center" title={user.phone || "No phone"}>
                  <IconPhone size={14} className="text-muted-foreground/50 mx-auto" />
                </td>
                {/* Status */}
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={user.isActive}
                    onCheckedChange={(checked) => handleToggleActive(user._id, checked)}
                  />
                </td>
                {/* Actions */}
                <td className="px-3 py-2">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/owner/app-users/${user._id}`); }}
                      className="p-1.5 rounded-lg bg-card border border-border/60 hover:border-primary/60 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all shadow-sm"
                      title="View"
                    >
                      <IconEye size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditSheet(user); }}
                      className="p-1.5 rounded-lg bg-card border border-border/60 hover:border-blue-400/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-muted-foreground hover:text-blue-500 transition-all shadow-sm"
                      title="Edit"
                    >
                      <IconEdit size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(user._id); }}
                      className="p-1.5 rounded-lg bg-card border border-border/60 hover:border-red-400/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-500 transition-all shadow-sm"
                      title="Delete"
                    >
                      <IconTrash size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state */}
        {filteredUsers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center">
              <IconUsers size={20} className="text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground/50 font-medium">
              {search.trim() ? "No users match your search." : "No users found."}
            </p>
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
