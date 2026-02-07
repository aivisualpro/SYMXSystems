"use client";

import { useRouter } from "next/navigation";

import { useEffect, useState } from "react";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { UserForm } from "@/components/admin/user-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash, User as UserIcon, Mail, Phone, FileText, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { TablePageSkeleton } from "@/components/skeletons";

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

export default function UsersPage() {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<User | null>(null);

  const router = useRouter();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users");
      const users = await response.json();
      if (Array.isArray(users)) {
        const sortedUsers = users.sort((a: User, b: User) => {
             // 1. Primary Sort: Serial No
             const serialA = a.serialNo ? String(a.serialNo).trim() : "";
             const serialB = b.serialNo ? String(b.serialNo).trim() : "";

             if (serialA && serialB) {
                 // Try numeric sort first if both look like numbers
                 const numA = Number(serialA);
                 const numB = Number(serialB);
                 if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
                     return numA - numB;
                 }
                 // Alpha-numeric sort strings (e.g. A1 vs A2)
                 if (serialA !== serialB) {
                    return serialA.localeCompare(serialB, undefined, { numeric: true });
                 }
             }
             
             // Put items WITH serialNo before items WITHOUT
             if (serialA && !serialB) return -1;
             if (!serialA && serialB) return 1;

             // 2. Secondary Sort: Name
             return (a.name || "").localeCompare(b.name || "");
        });
        setData(sortedUsers);
      }
    } catch (error) {
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (formData: Partial<User>) => {
    try {
      const url = editingItem
        ? `/api/admin/users/${editingItem._id}`
        : "/api/admin/users";
      const method = editingItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save user");

      toast.success(editingItem ? "User updated successfully" : "User created successfully");
      setIsSheetOpen(false);
      fetchUsers();
    } catch (error) {
       toast.error("Failed to save user");
    }
  };

  const handleDelete = async (id: string) => {
    toast("Are you sure you want to delete this user?", {
        action: {
            label: "Delete",
            onClick: async () => {
                try {
                    const response = await fetch(`/api/admin/users/${id}`, {
                        method: "DELETE",
                    });
                    if (!response.ok) throw new Error("Failed to delete user");
                    toast.success("User deleted successfully");
                    fetchUsers();
                } catch (error) {
                    toast.error("Failed to delete user");
                }
            },
        },
    });
  };

  const openAddSheet = () => {
    setEditingItem(null);
    setIsSheetOpen(true);
  };

  const openEditSheet = async (item: User) => {
    setEditingItem(item);
    setIsSheetOpen(true);

    try {
      const response = await fetch(`/api/admin/users/${item._id}`);
      if (response.ok) {
        const detailedUser = await response.json();
        setEditingItem(detailedUser);
      }
    } catch (error) {
      console.error("Failed to fetch user details", error);
    }
  };

  const columns: ColumnDef<User>[] = [
    {
      id: "profilePicture",
      header: "Image",
      cell: ({ row }) => (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted overflow-hidden">
               {row.original.profilePicture ? (
                   <img src={row.original.profilePicture} alt="User" className="h-full w-full object-cover" />
               ) : (
                   <UserIcon className="h-5 w-5 text-muted-foreground" />
               )}
          </div>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "designation",
      header: "Designation",
    },
    {
      accessorKey: "AppRole",
      header: "App Role",
    },
    {
      accessorKey: "email",
      header: "",
      cell: ({ row }) => (
         <div title={row.original.email} className="flex justify-center">
            <Mail className="h-4 w-4 text-muted-foreground" />
         </div>
      ),
    },
    {
      accessorKey: "phone",
      header: "",
      cell: ({ row }) => (
         <div title={row.original.phone || "No phone"} className="flex justify-center">
            <Phone className="h-4 w-4 text-muted-foreground" />
         </div>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
           <Switch 
              checked={row.original.isActive} 
              onCheckedChange={async (checked) => {
                 try {
                    // Optimistic update
                    const updatedData = data.map(u => 
                      u._id === row.original._id ? { ...u, isActive: checked } : u
                    );
                    setData(updatedData);

                    const response = await fetch(`/api/admin/users/${row.original._id}`, {
                       method: "PUT",
                       headers: { "Content-Type": "application/json" },
                       body: JSON.stringify({ isActive: checked }),
                    });
                    
                    if (!response.ok) {
                       throw new Error("Failed");
                    }
                    toast.success(`User ${checked ? 'activated' : 'deactivated'}`);
                 } catch (err) {
                    toast.error("Failed to update status");
                    fetchUsers(); // Revert on failure
                 }
              }}
           />
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => router.push(`/admin/users/${item._id}`)}>
                  <Eye className="mr-2 h-4 w-4" /> View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEditSheet(item)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                   className="text-destructive focus:text-destructive"
                   onClick={() => handleDelete(item._id)}
                >
                  <Trash className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  if (loading) {
    return <TablePageSkeleton />;
  }

  return (
    <div className="w-full h-full">
      <SimpleDataTable 
         data={data} 
         columns={columns} 
         title="Users" 
         onAdd={() => openAddSheet()} 
         loading={loading}
         showColumnToggle={false}
      />
      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <UserForm 
            initialData={editingItem || {}} 
            onSubmit={handleSubmit} 
            onCancel={() => setIsSheetOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
