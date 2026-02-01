"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash, ClipboardList, Package, Warehouse, Calendar, User, Hash } from "lucide-react";
import { format } from "date-fns";

interface ReleaseRequest {
  _id: string;
  poNo: string;
  product: any;
  stockingQty: number;
  trackingQty: number;
  location: string;
  lotNo: string;
  serial: string;
  expiryDate?: string;
  warehouse: any;
  createdBy: string;
  createdAt: string;
}

interface Product {
  _id: string;
  vbId: string;
  name: string;
}

interface Warehouse {
  _id: string;
  name: string;
}

export default function ReleaseRequestsPage() {
  const [data, setData] = useState<ReleaseRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReleaseRequest | null>(null);
  const [productSearch, setProductSearch] = useState("");

  const [formData, setFormData] = useState<Partial<ReleaseRequest>>({
    poNo: "",
    product: "",
    stockingQty: 0,
    trackingQty: 0,
    location: "",
    lotNo: "",
    serial: "",
    expiryDate: "",
    warehouse: "",
    createdBy: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [requestsRes, productsRes, warehousesRes] = await Promise.all([
        fetch("/api/admin/release-requests"),
        fetch("/api/admin/products"),
        fetch("/api/admin/warehouse"),
      ]);

      const [requests, products, warehouses] = await Promise.all([
        requestsRes.json(),
        productsRes.json(),
        warehousesRes.json(),
      ]);

      setData(requests);
      setProducts(products.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      setWarehouses(warehouses.sort((a: any, b: any) => a.name.localeCompare(b.name)));
    } catch (error) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem
        ? `/api/admin/release-requests/${editingItem._id}`
        : "/api/admin/release-requests";
      const method = editingItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success(editingItem ? "Update successful" : "Creation successful");
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error("An error occurred while saving");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this release request?")) return;
    try {
      const response = await fetch(`/api/admin/release-requests/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Deleted successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete item");
    }
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setProductSearch("");
    setFormData({
      poNo: "",
      product: "",
      stockingQty: 0,
      trackingQty: 0,
      location: "",
      lotNo: "",
      serial: "",
      expiryDate: "",
      warehouse: "",
      createdBy: "Adeel Jabbar", // Defaulting for now
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: ReleaseRequest) => {
    setEditingItem(item);
    setProductSearch("");
    setFormData({
      ...item,
      product: item.product?._id || item.product,
      warehouse: item.warehouse?._id || item.warehouse,
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : "",
    });
    setIsDialogOpen(true);
  };

  const columns: ColumnDef<ReleaseRequest>[] = [
    {
      accessorKey: "poNo",
      header: "PO No",
    },
    {
      accessorKey: "product.name",
      header: "Product",
      cell: ({ row }) => row.original.product?.name || "-",
    },
    {
      accessorKey: "trackingQty",
      header: "Track Qty",
    },
    {
      accessorKey: "location",
      header: "Location",
    },
    {
      accessorKey: "lotNo",
      header: "Lot No",
    },
    {
      accessorKey: "serial",
      header: "Serial",
    },
    {
      accessorKey: "expiryDate",
      header: "Expiry",
      cell: ({ row }) => row.original.expiryDate ? format(new Date(row.original.expiryDate), "MM/dd/yy") : "-",
    },
    {
      accessorKey: "warehouse.name",
      header: "Warehouse",
      cell: ({ row }) => row.original.warehouse?.name || "-",
    },
    {
      accessorKey: "createdBy",
      header: "Created By",
    },
    {
      accessorKey: "createdAt",
      header: "Created At",
      cell: ({ row }) => format(new Date(row.original.createdAt), "MMM dd, yyyy"),
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
              onClick={() => openEditDialog(item)}
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

  return (
    <div className="w-full h-full overflow-hidden">
      <SimpleDataTable
        columns={columns}
        data={data}
        searchKey="poNo"
        onAdd={openAddDialog}
        title="Release Requests"
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Release Request" : "Add Release Request"}</DialogTitle>
            <DialogDescription>
              Fill in the details for the inventory release request.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="poNo">PO Number</Label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="poNo"
                    className="pl-9"
                    value={formData.poNo || ""}
                    onChange={(e) => setFormData({ ...formData, poNo: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Product</Label>
                <Select 
                  value={formData.product} 
                  onValueChange={(val) => setFormData({ ...formData, product: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <div className="p-2 pb-1 sticky top-0 bg-background z-10">
                      <Input
                        placeholder="Search products..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="h-8"
                      />
                    </div>
                    {products
                      .filter(p => 
                        p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                        p.vbId.toLowerCase().includes(productSearch.toLowerCase())
                      )
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name} ({p.vbId})
                        </SelectItem>
                      ))}
                    {products.filter(p => 
                        p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                        p.vbId.toLowerCase().includes(productSearch.toLowerCase())
                      ).length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No products found
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="stockingQty">Stocking Qty</Label>
                <Input
                  id="stockingQty"
                  type="number"
                  value={formData.stockingQty || 0}
                  onChange={(e) => setFormData({ ...formData, stockingQty: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="trackingQty">Tracking Qty</Label>
                <Input
                  id="trackingQty"
                  type="number"
                  value={formData.trackingQty || 0}
                  onChange={(e) => setFormData({ ...formData, trackingQty: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location || ""}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="lotNo">Lot No</Label>
                <Input
                  id="lotNo"
                  value={formData.lotNo || ""}
                  onChange={(e) => setFormData({ ...formData, lotNo: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="serial">Serial</Label>
                <Input
                  id="serial"
                  value={formData.serial || ""}
                  onChange={(e) => setFormData({ ...formData, serial: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="expiryDate"
                    type="date"
                    className="pl-9"
                    value={formData.expiryDate || ""}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Warehouse</Label>
                <Select 
                  value={formData.warehouse} 
                  onValueChange={(val) => setFormData({ ...formData, warehouse: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((w) => (
                        <SelectItem key={w._id} value={w._id}>
                          {w.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:space-x-0">
              <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingItem ? "Save Changes" : "Submit Request"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
