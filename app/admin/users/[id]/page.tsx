"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserForm } from "@/components/admin/user-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Shield, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle,
  Hash,
  PenTool,
  Globe,
  Pencil,
  Lock,
  Activity,
  FileText
} from "lucide-react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  AppRole: "Super Admin" | "Manager";
  isActive: boolean;
  serialNo?: string;
  designation?: string;
  bioDescription?: string;
  profilePicture?: string;
  signature?: string;
  isOnWebsite?: boolean;
}

export default function UserDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { setLeftContent } = useHeaderActions();

  useEffect(() => {
    setLeftContent(
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">User Details</h1>
      </div>
    );
    return () => setLeftContent(null);
  }, [setLeftContent, router]);

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/admin/users/${id}`);
      if (!response.ok) {
         if (response.status === 404) throw new Error("User not found");
         throw new Error("Failed to fetch user");
      }
      const data = await response.json();
      setUser(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
      router.push("/admin/users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchUser();
    }
  }, [id, router]);

  const handleSubmit = async (formData: Partial<User>) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to update user");

      toast.success("User updated successfully");
      setIsEditDialogOpen(false);
      
      // Refresh user data
      const updatedUser = await response.json();
      setUser(updatedUser);
    } catch (error) {
      toast.error("Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500" style={{ zoom: "90%" }}>
      {/* Header Card Refined to match '90% zoom' look at 100% */}
      <div className="relative rounded-3xl overflow-hidden bg-zinc-950 text-white shadow-xl flex flex-col md:flex-row min-h-[340px] border border-primary/10">
         {/* Edit Button - Top Right Corner Icon */}
         <div className="absolute top-5 right-5 z-20">
            <Button 
               variant="ghost" 
               size="icon" 
               className="h-8 w-8 bg-primary/10 hover:bg-primary/20 text-white border border-primary/20 rounded-full transition-all"
               onClick={() => setIsEditDialogOpen(true)}
            >
               <Pencil className="h-4 w-4" />
            </Button>
         </div>

         {/* Left Side - Hero Image */}
         <div className="w-full md:w-2/5 relative bg-zinc-900 min-h-[300px] md:min-h-full">
            {user.profilePicture ? (
               <img 
                  src={user.profilePicture} 
                  alt={user.name} 
                  className="absolute inset-0 w-full h-full object-cover opacity-90" 
               />
            ) : (
               <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                  <UserIcon className="h-32 w-32 text-zinc-600" />
               </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-zinc-950/20" />
         </div>

         {/* Right Side - Content */}
         <div className="w-full md:w-3/5 p-5 md:p-7 flex flex-col justify-center space-y-3">
            <div className="space-y-1">
               <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">{user.name}</h1>
            </div>

            <div className="text-zinc-400 text-[13px] leading-relaxed max-w-xl whitespace-pre-wrap opacity-90">
               {user.bioDescription || "Enrich your expertise and grow your career. The development of both technical and human skills is at the heart of our Group's success."}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
               {/* Role Badge */}
               <div className="inline-flex items-center px-2.5 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary text-[12px] font-medium shadow-[0_0_15px_-3px_rgba(var(--primary),0.2)]">
                  <Shield className="mr-1.5 h-3 w-3" />
                  {user.AppRole}
               </div>

               {/* Designation Badge */}
               <div className="inline-flex items-center px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary/90 text-[12px] font-medium">
                  <Briefcase className="mr-1.5 h-3 w-3 text-primary" />
                  {user.designation || "Team Member"}
               </div>


               {/* Website Visibility Badge */}
               <div className={`inline-flex items-center px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-[12px] font-medium ${user.isOnWebsite ? "text-primary/90" : "text-zinc-500"}`}>
                  <Globe className={`mr-1.5 h-3 w-3 ${user.isOnWebsite ? "text-primary" : "text-zinc-500"}`} />
                  {user.isOnWebsite ? "On Website" : "Hidden"}
               </div>

               {/* Status Badge */}
               <div className={`inline-flex items-center px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-[12px] font-medium ${user.isActive ? "text-primary/90" : "text-zinc-500"}`}>
                  <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${user.isActive ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "bg-zinc-600"}`} />
                  {user.isActive ? "Active" : "Inactive"}
               </div>
            </div>

            {/* Glass Grid */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-3.5 grid grid-cols-2 gap-x-5 gap-y-2.5 items-stretch">
               <div className="space-y-1">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
                     <Mail className="h-3 w-3 text-primary" /> Email
                  </p>
                  <p className="text-zinc-200 text-sm font-medium break-all">{user.email}</p>
               </div>
               <div className="space-y-1">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
                     <Phone className="h-3 w-3 text-primary" /> Phone
                  </p>
                  <p className="text-zinc-200 text-sm font-medium">{user.phone || "Not provided"}</p>
               </div>
               <div className="space-y-1">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
                     <MapPin className="h-3 w-3 text-primary" /> Address
                  </p>
                  <p className="text-zinc-200 text-sm font-medium">{user.address || "Not provided"}</p>
               </div>
               <div className="space-y-1 flex flex-col">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
                     <PenTool className="h-3 w-3 text-primary" /> Signature
                  </p>
                  {user.signature ? (
                     <div className="bg-white/10 rounded flex-1 flex items-center justify-center px-2 min-h-[32px]">
                        <img src={user.signature} alt="Signature" className="h-full max-h-8 w-auto object-contain invert brightness-200" />
                     </div>
                  ) : (
                     <p className="text-zinc-600 text-xs italic">Not provided</p>
                  )}
               </div>
            </div>

            {/* Account Security */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4 space-y-4">
               <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  <h3 className="text-zinc-200 text-sm font-semibold tracking-wide uppercase italic">Account Security</h3>
               </div>
               
               <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-1 w-full space-y-1.5">
                     <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Change Password</p>
                     <div className="relative group/pass">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within/pass:text-primary transition-colors" />
                        <input 
                           type="text" 
                           placeholder="Enter new password"
                           id="new-password-input"
                           className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-200 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-zinc-700"
                        />
                     </div>
                  </div>
                  <Button 
                     size="sm"
                     className="bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-wider h-10 px-6 rounded-xl transition-all shadow-lg shadow-primary/10 active:scale-95 whitespace-nowrap"
                     onClick={async () => {
                        const input = document.getElementById("new-password-input") as HTMLInputElement;
                        const newPassword = input.value;
                        if (!newPassword) {
                           toast.error("Please enter a new password");
                           return;
                        }
                        try {
                           const res = await fetch("/api/auth/change-password", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ userId: user._id, newPassword })
                           });
                           if (!res.ok) throw new Error("Failed to change password");
                           toast.success("Password updated successfully");
                           input.value = "";
                        } catch (err) {
                           toast.error("Failed to update password");
                        }
                     }}
                  >
                     Update Password
                  </Button>
               </div>
            </div>
         </div>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update member profile information.</DialogDescription>
          </DialogHeader>
          <UserForm 
            initialData={user || {} as User} 
            onSubmit={handleSubmit} 
            onCancel={() => setIsEditDialogOpen(false)}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
