"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
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
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash, ShoppingCart, Calendar, Tag, FileType } from "lucide-react";
import { TablePageSkeleton } from "@/components/skeletons";

interface PurchaseOrder {
  _id: string;
  vbpoNo: string;
  orderType: string;
  category: string;
  date: string;
  createdBy: string;
  customerPO?: {
    shipping?: any[];
  }[];
}

export default function PurchaseOrdersPage() {
  const [data, setData] = useState<PurchaseOrder[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PurchaseOrder | null>(null);

  const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
    vbpoNo: "",
    orderType: "",
    category: "",
    createdBy: "",
    date: new Date().toISOString().split('T')[0],
  });

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json();
      if (Array.isArray(data)) {
        const mapping: Record<string, string> = {};
        data.forEach((u: any) => {
          mapping[u.email.toLowerCase()] = u.name;
        });
        setUsers(mapping);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/purchase-orders");
      const items = await response.json();
      if (Array.isArray(items)) {
        // Sort latest on top
        const sortedItems = [...items].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setData(sortedItems);
      }
    } catch (error) {
      toast.error("Failed to fetch purchase orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem
        ? `/api/admin/purchase-orders/${editingItem._id}`
        : "/api/admin/purchase-orders";
      const method = editingItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success(editingItem ? "Purchase Order updated" : "Purchase Order created");
      setIsSheetOpen(false);
      fetchItems();
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this purchase order?")) return;
    try {
      const response = await fetch(`/api/admin/purchase-orders/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Purchase Order deleted");
      fetchItems();
    } catch (error) {
      toast.error("Failed to delete purchase order");
    }
  };

  const openAddSheet = () => {
    setEditingItem(null);
    setFormData({
      vbpoNo: "",
      orderType: "",
      category: "",
      createdBy: "",
      date: new Date().toISOString().split('T')[0],
    });
    setIsSheetOpen(true);
  };

  const openEditSheet = (item: PurchaseOrder) => {
    setEditingItem(item);
    // Ensure date is formatted for input
    const formattedDate = item.date ? new Date(item.date).toISOString().split('T')[0] : "";
    setFormData({ ...item, date: formattedDate });
    setIsSheetOpen(true);
  };

  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      accessorKey: "vbpoNo",
      header: "VB PO #",
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => {
        const dateAttr = row.getValue("date");
        if (!dateAttr) return "-";
        const d = new Date(dateAttr as string);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
      },
    },
    {
      accessorKey: "orderType",
      header: "Order Type",
    },
    {
      accessorKey: "category",
      header: "Category",
    },
    {
      id: "customerPos",
      header: "Customer POs",
      cell: ({ row }) => {
        const count = row.original.customerPO?.length || 0;
        return (
          <div className="flex items-center gap-1">
             <span className="text-foreground">{count}</span>
          </div>
        );
      },
    },
    {
      id: "shippings",
      header: "Shippings",
      cell: ({ row }) => {
        const count = row.original.customerPO?.reduce((acc, cpo) => acc + (cpo.shipping?.length || 0), 0) || 0;
        return (
          <div className="flex items-center gap-1">
             <span className="text-primary">{count}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "createdBy",
      header: "Created By",
      cell: ({ row }) => {
        const email = row.getValue("createdBy") as string;
        if (!email) return "-";
        return users[email.toLowerCase()] || email;
      },
    },
    {
      id: "details",
      header: "Details",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/purchase-orders/${row.original._id}`}>
            View Details
          </Link>
        </Button>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEditSheet(item)}
              className="h-8 w-8 p-0"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(item._id)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Delete"
            >
              <Trash className="h-4 w-4" />
            </Button>
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
        columns={columns}
        data={data}
        searchKey="vbpoNo"
        onAdd={openAddSheet}
      />

      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Purchase Order" : "Add Purchase Order"}</DialogTitle>
            <DialogDescription>
              manage purchase order details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="vbpoNo">VB PO #</Label>
                <div className="relative">
                  <ShoppingCart className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="vbpoNo"
                    className="pl-9"
                    value={formData.vbpoNo || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, vbpoNo: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="date"
                    type="date"
                    className="pl-9"
                    value={formData.date || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="orderType">Order Type</Label>
                <div className="relative">
                  <FileType className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                   <Input
                    id="orderType"
                    className="pl-9"
                    value={formData.orderType || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, orderType: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <div className="relative">
                  <Tag className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="category"
                    className="pl-9"
                    value={formData.category || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="createdBy">Created By</Label>
              <Input
                id="createdBy"
                value={formData.createdBy || ""}
                onChange={(e) =>
                  setFormData({ ...formData, createdBy: e.target.value })
                }
              />
            </div>
            <DialogFooter className="gap-2 sm:space-x-0">
               <Button variant="outline" type="button" onClick={() => setIsSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingItem ? "Save Changes" : "Create PO"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
