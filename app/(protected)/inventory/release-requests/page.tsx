"use client";

import { useEffect, useState } from "react";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Pencil, Trash, Plus, X, Hash, Truck, MapPin } from "lucide-react";
import { format } from "date-fns";
import { TablePageSkeleton } from "@/components/skeletons";

interface IReleaseOrderProduct {
  product: string;
  qty: number;
  lotSerial: string;
}

interface ReleaseRequest {
  _id: string;
  poNo: string;
  date: string;
  warehouse: any;
  requestedBy: any;
  customer: any;
  contact: string;
  releaseOrderProducts: IReleaseOrderProduct[];
  carrier: string;
  requestedPickupTime?: string;
  scheduledPickupDate?: string;
  scheduledPickupTime?: string;
  instructions?: string;
  createdBy: string;
  createdAt: string;
}

export default function ReleaseRequestsPage() {
  const [data, setData] = useState<ReleaseRequest[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReleaseRequest | null>(null);
  
  // Search states for dropdowns
  const [productSearch, setProductSearch] = useState("");

  const defaultFormData: Partial<ReleaseRequest> = {
    poNo: "",
    date: new Date().toISOString().split('T')[0],
    warehouse: "",
    requestedBy: "",
    customer: "",
    contact: "",
    releaseOrderProducts: [
      { product: "", qty: 0, lotSerial: "" },
      { product: "", qty: 0, lotSerial: "" },
      { product: "", qty: 0, lotSerial: "" }
    ],
    carrier: "",
    requestedPickupTime: "",
    scheduledPickupDate: "",
    scheduledPickupTime: "",
    instructions: ""
  };

  const [formData, setFormData] = useState<Partial<ReleaseRequest>>(defaultFormData);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [requestsRes, productsRes, warehousesRes, customersRes, usersRes] = await Promise.all([
        fetch("/api/admin/release-requests"),
        fetch("/api/admin/products"),
        fetch("/api/admin/warehouse"),
        fetch("/api/admin/customers"), // Assuming endpoint exists
        fetch("/api/admin/users"),     // Assuming endpoint exists
      ]);

      if (requestsRes.ok) setData(await requestsRes.json());
      if (productsRes.ok) setProducts((await productsRes.json()).sort((a: any, b: any) => a.name.localeCompare(b.name)));
      if (warehousesRes.ok) setWarehouses((await warehousesRes.json()).sort((a: any, b: any) => a.name.localeCompare(b.name)));
      if (customersRes.ok) setCustomers(await customersRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      
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

      const payload = {
        ...formData,
        // Filter out empty rows if needed, or keep them to let backend handle validation
        releaseOrderProducts: formData.releaseOrderProducts?.filter(p => p.product && p.product !== "")
      };

      if (!payload.releaseOrderProducts || payload.releaseOrderProducts.length === 0) {
        toast.error("Please add at least one product");
        return;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success(editingItem ? "Update successful" : "Creation successful");
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error("An error occurred while saving");
      console.error(error);
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
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: ReleaseRequest) => {
    setEditingItem(item);
    setProductSearch("");
    setFormData({
      ...item,
      warehouse: item.warehouse?._id || item.warehouse,
      requestedBy: item.requestedBy?._id || item.requestedBy,
      customer: item.customer?._id || item.customer,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : "",
      scheduledPickupDate: item.scheduledPickupDate ? new Date(item.scheduledPickupDate).toISOString().split('T')[0] : "",
      releaseOrderProducts: item.releaseOrderProducts.length > 0 ? item.releaseOrderProducts : defaultFormData.releaseOrderProducts
    });
    setIsDialogOpen(true);
  };

  // Helper for Product Rows
  const updateProductRow = (index: number, field: keyof IReleaseOrderProduct, value: any) => {
    const newRows = [...(formData.releaseOrderProducts || [])];
    newRows[index] = { ...newRows[index], [field]: value };
    setFormData({ ...formData, releaseOrderProducts: newRows });
  };

  const addProductRow = () => {
    setFormData({
      ...formData,
      releaseOrderProducts: [...(formData.releaseOrderProducts || []), { product: "", qty: 0, lotSerial: "" }]
    });
  };

  const removeProductRow = (index: number) => {
    const newRows = [...(formData.releaseOrderProducts || [])];
    if (newRows.length > 1) {
        newRows.splice(index, 1);
        setFormData({ ...formData, releaseOrderProducts: newRows });
    }
  };

  // Get selected Customer object to show locations
  const selectedCustomer = customers.find(c => c._id === formData.customer);

  if (loading) {
    return <TablePageSkeleton />;
  }

  const columns: ColumnDef<ReleaseRequest>[] = [
    {
      accessorKey: "poNo",
      header: "PO No",
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) => row.original.customer?.name || "-",
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => row.original.date ? format(new Date(row.original.date), "MMM dd, yyyy") : "-",
    },
    {
      accessorKey: "warehouse.name",
      header: "Warehouse",
      cell: ({ row }) => row.original.warehouse?.name || "-",
    },
    {
        accessorKey: "products",
        header: "Items",
        cell: ({ row }) => row.original.releaseOrderProducts?.length || 0,
    },
    {
      accessorKey: "createdBy",
      header: "Created By",
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Release Request" : "Add Release Request"}</DialogTitle>
            <DialogDescription>
                Fill in the details below to create or update a release request.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-8 py-4">
            
            {/* SECTION 1: General Info */}
            <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2"><Hash className="w-4 h-4"/> General Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {/* Row 1: Date, Warehouse, Requested By */}
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Input 
                            type="date" 
                            value={formData.date || ""}
                            onChange={(e) => setFormData({...formData, date: e.target.value})}
                            required
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Warehouse</Label>
                            <Select 
                            value={formData.warehouse} 
                            onValueChange={(val) => setFormData({ ...formData, warehouse: val })}
                            required
                            >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Warehouse" />
                            </SelectTrigger>
                            <SelectContent>
                                {warehouses.map((w) => (
                                    <SelectItem key={w._id} value={w._id}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Requested By</Label>
                            <Select 
                            value={formData.requestedBy} 
                            onValueChange={(val) => setFormData({ ...formData, requestedBy: val })}
                            >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select User" />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map((u) => (
                                    <SelectItem key={u._id} value={u._id}>{u.name || u.email}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Row 2: Customer, Contact/Location, Customer PO # */}
                    <div className="space-y-2">
                        <Label>Customer</Label>
                            <Select 
                            value={formData.customer} 
                            onValueChange={(val) => setFormData({ ...formData, customer: val, contact: "" })}
                            required
                            >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Customer" />
                            </SelectTrigger>
                            <SelectContent>
                                {customers.map((c) => (
                                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Contact / Location</Label>
                        <Select 
                            value={formData.contact} 
                            onValueChange={(val) => setFormData({ ...formData, contact: val })}
                            disabled={!selectedCustomer}
                            >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Location" />
                            </SelectTrigger>
                            <SelectContent>
                                {selectedCustomer?.location?.map((loc: any, i: number) => (
                                    <SelectItem key={i} value={loc.locationName || `Loc ${i+1}`}>
                                        {loc.locationName || loc.fullAddress || "Unknown Location"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Customer PO #</Label>
                        <Input 
                                value={formData.poNo || ""}
                                onChange={(e) => setFormData({...formData, poNo: e.target.value})}
                                placeholder="Enter PO Number"
                                required
                        />
                    </div>
                </div>
            </div>

            {/* SECTION 2: Products */}
            <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg flex items-center gap-2"><Trash className="w-4 h-4"/> Order Details</h3>
                    <Button type="button" size="sm" variant="outline" onClick={addProductRow}>
                        <Plus className="w-4 h-4 mr-2" /> Add Product
                    </Button>
                 </div>
                 
                 <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="p-3 text-left w-[40%]">Product</th>
                                <th className="p-3 text-left w-[20%]">Release Qty</th>
                                <th className="p-3 text-left w-[30%]">Lot / Serial #</th>
                                <th className="p-3 w-[10%]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {formData.releaseOrderProducts?.map((row, idx) => (
                                <tr key={idx} className="bg-background">
                                    <td className="p-2">
                                         <Select 
                                            value={row.product} 
                                            onValueChange={(val) => updateProductRow(idx, 'product', val)}
                                         >
                                            <SelectTrigger className="w-full border-none shadow-none h-8">
                                                <SelectValue placeholder="Search Product..." />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[300px]">
                                                <div className="p-2 pb-1 sticky top-0 bg-background z-10">
                                                  <Input
                                                    placeholder="Filter products..."
                                                    value={productSearch}
                                                    onChange={(e) => setProductSearch(e.target.value)}
                                                    onKeyDown={(e: any) => e.stopPropagation()}
                                                    className="h-8"
                                                  />
                                                </div>
                                                {products
                                                  .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
                                                  .map((p) => (
                                                    <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="p-2">
                                        <Input 
                                            type="number" 
                                            value={row.qty}
                                            onChange={(e) => updateProductRow(idx, 'qty', Number(e.target.value))}
                                            className="h-8 shadow-none"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <Input 
                                            value={row.lotSerial}
                                            onChange={(e) => updateProductRow(idx, 'lotSerial', e.target.value)}
                                            className="h-8 shadow-none"
                                        />
                                    </td>
                                    <td className="p-2 text-center">
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                                            onClick={() => removeProductRow(idx)}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>

            {/* SECTION 3: Pickup Details */}
            <div className="space-y-4">
                 <h3 className="font-semibold text-lg flex items-center gap-2"><Truck className="w-4 h-4"/> Pickup Information</h3>
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                         <Label>Carrier</Label>
                         <Input 
                            value={formData.carrier || ""}
                            onChange={(e) => setFormData({...formData, carrier: e.target.value})}
                            placeholder="Carrier Name"
                         />
                      </div>
                      <div className="space-y-2">
                         <Label>Requested Date/Time</Label>
                         <Input 
                            type="datetime-local" 
                            value={formData.requestedPickupTime ? new Date(formData.requestedPickupTime).toISOString().slice(0, 16) : ""}
                            onChange={(e) => setFormData({...formData, requestedPickupTime: e.target.value})}
                         />
                      </div>
                       <div className="space-y-2">
                         <Label>Confirmed Date</Label>
                         <Input 
                            type="date"
                            value={formData.scheduledPickupDate || ""}
                            onChange={(e) => setFormData({...formData, scheduledPickupDate: e.target.value})}
                         />
                      </div>
                       <div className="space-y-2">
                         <Label>Confirmed Time</Label>
                         <Input 
                            type="time"
                            value={formData.scheduledPickupTime || ""}
                            onChange={(e) => setFormData({...formData, scheduledPickupTime: e.target.value})}
                         />
                      </div>
                 </div>
            </div>

             {/* SECTION 4: Instructions */}
            <div className="space-y-4">
                 <h3 className="font-semibold text-lg flex items-center gap-2"><MapPin className="w-4 h-4"/> Instructions</h3>
                 <Textarea 
                    value={formData.instructions || ""}
                    onChange={(e) => setFormData({...formData, instructions: e.target.value})}
                    placeholder="Additional delivery or handling instructions..."
                    className="min-h-[100px]"
                 />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
                 <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                 <Button type="submit" size="lg" className="min-w-[150px]">
                    {editingItem ? "Update Request" : "Create Request"}
                 </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
