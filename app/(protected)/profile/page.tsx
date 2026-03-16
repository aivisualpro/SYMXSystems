"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  IconUser,
  IconMail,
  IconPhone,
  IconMapPin,
  IconBriefcase,
  IconShield,
  IconEdit,
  IconCheck,
  IconX,
  IconCamera,
  IconLoader2,
  IconCalendar,
  IconBuilding,
  IconFileDescription,
  IconLock,
  IconEye,
  IconEyeOff,
  IconDeviceFloppy,
  IconSparkles,
  IconCircleCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { cn } from "@/lib/utils";

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  AppRole: string;
  designation?: string;
  bioDescription?: string;
  isOnWebsite?: boolean;
  profilePicture?: string;
  isActive: boolean;
  signature?: string;
  location?: string;
  createdAt?: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  const [mounted, setMounted] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const { setLeftContent, setRightContent } = useHeaderActions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/user/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      const data = await res.json();
      setProfile(data);
      setEditForm(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Header actions
  useEffect(() => {
    if (!profile) return;

    setLeftContent(
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          My Profile
        </h1>
      </div>
    );

    setRightContent(
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setEditForm(profile); }}>
              <IconX size={16} className="mr-1.5" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <IconLoader2 size={16} className="mr-1.5 animate-spin" /> : <IconDeviceFloppy size={16} className="mr-1.5" />}
              Save Changes
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => setShowPasswordDialog(true)}>
              <IconLock size={16} className="mr-1.5" /> Change Password
            </Button>
            <Button size="sm" onClick={() => setIsEditing(true)}>
              <IconEdit size={16} className="mr-1.5" /> Edit Profile
            </Button>
          </>
        )}
      </div>
    );

    return () => { setLeftContent(null); setRightContent(null); };
  }, [profile, isEditing, saving]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      const updated = await res.json();
      setProfile(updated);
      setEditForm(updated);
      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error("Please fill in all fields"); return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match"); return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters"); return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile?._id, newPassword: passwordForm.newPassword }),
      });
      if (!res.ok) throw new Error("Failed to change password");
      toast.success("Password changed successfully!");
      setShowPasswordDialog(false);
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    } catch {
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setEditForm(prev => ({ ...prev, profilePicture: base64 }));
      try {
        const res = await fetch("/api/user/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profilePicture: base64 }),
        });
        if (res.ok) {
          const updated = await res.json();
          setProfile(updated);
          toast.success("Profile picture updated!");
        }
      } catch {
        toast.error("Failed to upload picture");
      }
    };
    reader.readAsDataURL(file);
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-primary/10 animate-pulse" />
            <IconLoader2 size={28} className="absolute inset-0 m-auto text-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const profilePic = isEditing ? editForm.profilePicture : profile.profilePicture;

  return (
    <>
      <ScrollArea className="h-[calc(100vh-8rem)]">
        <div className={cn(
          "max-w-4xl mx-auto pb-12 transition-all duration-700",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}>

          {/* ── Hero Card ──────────────────────────────────────────── */}
          <div className="relative overflow-hidden rounded-2xl border bg-card mb-6">
            {/* Gradient Banner */}
            <div className="h-36 md:h-44 bg-gradient-to-br from-primary/80 via-primary/40 to-primary/10 relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.06]"
                style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: "24px 24px" }}
              />
              <div className="absolute top-6 right-10 w-32 h-32 rounded-full bg-white/5 blur-2xl animate-pulse" />
              <div className="absolute bottom-2 left-16 w-40 h-20 rounded-full bg-white/5 blur-3xl" />
            </div>

            {/* Profile info card body */}
            <div className="relative px-6 md:px-8 pb-6">
              {/* Avatar */}
              <div className="absolute -top-14 left-6 md:left-8">
                <div className="relative group">
                  <div className="h-28 w-28 rounded-2xl border-[4px] border-card shadow-xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5">
                    {profilePic ? (
                      <Image src={profilePic} alt={profile.name} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary to-primary/60">
                        <span className="text-3xl font-bold text-primary-foreground">{getInitials(profile.name)}</span>
                      </div>
                    )}
                  </div>
                  {isEditing && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer"
                    >
                      <IconCamera size={24} className="text-white" />
                    </button>
                  )}
                  {profile.isActive && (
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-[3px] border-card">
                      <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
                    </div>
                  )}
                </div>
              </div>

              {/* Name + Meta — positioned to the right of avatar */}
              <div className="pt-16 md:pt-2 md:ml-36">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    {isEditing ? (
                      <Input
                        value={editForm.name || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="text-xl font-bold h-auto py-1 px-0 border-0 border-b-2 border-primary/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary"
                        placeholder="Your Name"
                      />
                    ) : (
                      <h2 className="text-xl md:text-2xl font-bold tracking-tight">{profile.name}</h2>
                    )}

                    {/* Single-line meta: designation · location · joined */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                      {profile.designation && (
                        <span className="flex items-center gap-1">
                          <IconBriefcase size={14} className="text-primary/50" />
                          {profile.designation}
                        </span>
                      )}
                      {profile.location && (
                        <span className="flex items-center gap-1">
                          <IconMapPin size={14} className="text-primary/50" />
                          {profile.location}
                        </span>
                      )}
                      {profile.createdAt && (
                        <span className="flex items-center gap-1">
                          <IconCalendar size={14} className="text-primary/50" />
                          Joined {formatDate(profile.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs px-2.5 py-1">
                      <IconShield size={12} className="mr-1" />
                      {profile.AppRole}
                    </Badge>
                    <Badge variant="secondary" className={cn(
                      "text-xs px-2.5 py-1",
                      profile.isActive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                    )}>
                      {profile.isActive ? <IconCircleCheck size={12} className="mr-1" /> : <IconAlertTriangle size={12} className="mr-1" />}
                      {profile.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Content Grid ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* ──── Left Column (2/5) ──────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">

              {/* Contact Info */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-5 py-3.5 border-b bg-muted/30">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <IconUser size={16} className="text-primary" />
                    Contact Information
                  </h3>
                </div>
                <div className="p-5 space-y-3.5">
                  <InfoRow icon={<IconMail size={15} />} label="Email" value={profile.email} />
                  <Separator className="opacity-50" />
                  <InfoRow
                    icon={<IconPhone size={15} />} label="Phone"
                    value={isEditing ? editForm.phone : profile.phone}
                    editable={isEditing}
                    onChange={(v) => setEditForm(prev => ({ ...prev, phone: v }))}
                    placeholder="Add phone number"
                  />
                  <Separator className="opacity-50" />
                  <InfoRow
                    icon={<IconMapPin size={15} />} label="Address"
                    value={isEditing ? editForm.address : profile.address}
                    editable={isEditing}
                    onChange={(v) => setEditForm(prev => ({ ...prev, address: v }))}
                    placeholder="Add address"
                  />
                  {isEditing && (
                    <>
                      <Separator className="opacity-50" />
                      <InfoRow
                        icon={<IconBuilding size={15} />} label="Location"
                        value={editForm.location}
                        editable
                        onChange={(v) => setEditForm(prev => ({ ...prev, location: v }))}
                        placeholder="Add work location"
                      />
                      <Separator className="opacity-50" />
                      <InfoRow
                        icon={<IconBriefcase size={15} />} label="Designation"
                        value={editForm.designation}
                        editable
                        onChange={(v) => setEditForm(prev => ({ ...prev, designation: v }))}
                        placeholder="Add designation"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Signature (only if exists) */}
              {profile.signature && (
                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="px-5 py-3.5 border-b bg-muted/30">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <IconSparkles size={16} className="text-primary" />
                      Digital Signature
                    </h3>
                  </div>
                  <div className="p-5">
                    <div className="bg-muted/30 rounded-xl p-5 flex items-center justify-center border border-dashed">
                      <Image
                        src={profile.signature}
                        alt="Signature"
                        width={240}
                        height={80}
                        className="object-contain max-h-20 dark:invert"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ──── Right Column (3/5) ─────────────────────────────── */}
            <div className="lg:col-span-3 space-y-6">

              {/* About Me */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-5 py-3.5 border-b bg-muted/30">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <IconFileDescription size={16} className="text-primary" />
                    About Me
                  </h3>
                </div>
                <div className="p-5">
                  {isEditing ? (
                    <Textarea
                      value={editForm.bioDescription || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, bioDescription: e.target.value }))}
                      placeholder="Tell us about yourself, your experience, and your role..."
                      className="min-h-[120px] resize-none bg-muted/30 border-dashed"
                    />
                  ) : (
                    <p className={cn(
                      "text-sm leading-relaxed whitespace-pre-wrap",
                      profile.bioDescription ? "text-foreground" : "text-muted-foreground italic"
                    )}>
                      {profile.bioDescription || "No bio added yet. Click \"Edit Profile\" to add your bio."}
                    </p>
                  )}
                </div>
              </div>

              {/* Account Security */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="px-5 py-3.5 border-b bg-muted/30">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <IconLock size={16} className="text-primary" />
                    Account Security
                  </h3>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                        <IconLock size={18} className="text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Password</p>
                        <p className="text-xs text-muted-foreground">Last changed — unknown</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowPasswordDialog(true)}>
                      Change
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />

      {/* ── Change Password Dialog ─────────────────────────────────── */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconLock size={20} className="text-primary" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              Enter a new password. Must be at least 6 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showNewPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm new password"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showConfirmPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>
            {passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <IconAlertTriangle size={12} /> Passwords do not match
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
            <Button onClick={handlePasswordChange} disabled={changingPassword}>
              {changingPassword ? <IconLoader2 size={16} className="mr-1.5 animate-spin" /> : <IconCheck size={16} className="mr-1.5" />}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Reusable Info Row ────────────────────────────────────────────── */
function InfoRow({
  icon, label, value, editable = false, onChange, placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        {editable ? (
          <Input
            value={value || ""}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            className="h-7 text-sm bg-muted/30 border-dashed mt-0.5"
          />
        ) : (
          <p className={cn("text-sm font-medium truncate", !value && "text-muted-foreground italic text-xs")}>
            {value || "Not provided"}
          </p>
        )}
      </div>
    </div>
  );
}
