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
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash, Hash, Factory, MapPin, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import Link from "next/link";

interface SupplierLocation {
  vbId: string;
  locationName: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  fullAddress: string;
  website: string;
}

interface Supplier {
  _id: string;
  vbId: string;
  name: string;
  location: SupplierLocation[];
}

import { Plus, Globe } from "lucide-react";

export default function SuppliersPage() {
  const router = useRouter();
  const [data, setData] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState<Partial<Supplier>>({
    vbId: "",
    name: "",
    location: [],
  });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/suppliers");
      const items = await response.json();
      if (Array.isArray(items)) {
        setData(items);
      }
    } catch (error) {
      toast.error("Failed to fetch suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem
        ? `/api/admin/suppliers/${editingItem._id}`
        : "/api/admin/suppliers";
      const method = editingItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success(editingItem ? "Supplier updated" : "Supplier created");
      setIsSheetOpen(false);
      fetchItems();
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this supplier?")) return;
    try {
      const response = await fetch(`/api/admin/suppliers/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Supplier deleted");
      fetchItems();
    } catch (error) {
      toast.error("Failed to delete supplier");
    }
  };

  const openAddSheet = () => {
    setEditingItem(null);
    setFormData({
      vbId: "",
      name: "",
      location: [],
    });
    setIsSheetOpen(true);
  };

  const openEditSheet = (item: Supplier) => {
    setEditingItem(item);
    setFormData({
      ...item,
      location: item.location || [],
    });
    setIsSheetOpen(true);
  };

  const handleAddLocation = () => {
    setFormData({
      ...formData,
      location: [
        ...(formData.location || []),
        {
          vbId: "",
          locationName: "",
          street: "",
          city: "",
          state: "",
          country: "",
          zip: "",
          fullAddress: "",
          website: "",
        },
      ],
    });
  };

  const handleRemoveLocation = (index: number) => {
    const newLocations = [...(formData.location || [])];
    newLocations.splice(index, 1);
    setFormData({ ...formData, location: newLocations });
  };

  const handleLocationChange = (index: number, field: keyof SupplierLocation, value: string) => {
    const newLocations = [...(formData.location || [])];
    const currentLocation = { ...newLocations[index], [field]: value };

    // Auto-sync fullAddress from fields
    if (['street', 'city', 'state', 'zip', 'country'].includes(field)) {
      const { street, city, state, zip, country } = currentLocation;
      const parts = [street, city, state, zip, country].filter(Boolean);
      currentLocation.fullAddress = parts.join(", ");
    }
    
    // Auto-sync fields from fullAddress (Basic parsing)
    if (field === 'fullAddress') {
      const parts = value.split(',').map(s => s.trim());
      if (parts.length > 0) currentLocation.street = parts[0] || "";
      if (parts.length > 1) currentLocation.city = parts[1] || "";
      if (parts.length > 2) currentLocation.state = parts[2] || "";
      if (parts.length > 3) currentLocation.zip = parts[3] || "";
      if (parts.length > 4) currentLocation.country = parts[4] || "";
    }

    newLocations[index] = currentLocation;
    setFormData({ ...formData, location: newLocations });
  };

  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: "vbId",
      header: "VB ID",
    },
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      id: "locations",
      header: "Locations",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-1.5">
             <MapPin className="h-3 w-3 text-muted-foreground" />
             <span className="font-medium text-xs">
                {item.location?.length || 0}
             </span>
          </div>
        );
      },
    },
    {
      id: "details",
      header: "Details",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/suppliers/${row.original._id}`}>
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
              onClick={(e) => {
                e.stopPropagation();
                openEditSheet(item);
              }}
              className="h-8 w-8 p-0"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(item._id);
              }}
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
    <div className="w-full h-full">
      <SimpleDataTable
        columns={columns}
        data={data}
        searchKey="name"
        onAdd={openAddSheet}
      />

      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
            <DialogDescription>
              manage supplier details and locations.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="vbId">VB ID</Label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="vbId"
                    className="pl-9"
                    value={formData.vbId || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, vbId: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <div className="relative">
                  <Factory className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    className="pl-9"
                    value={formData.name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Locations</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddLocation}>
                  <Plus className="mr-2 h-3 w-3" /> Add Location
                </Button>
              </div>
              
              <div className="space-y-4">
                {formData.location?.map((loc, index) => (
                  <div key={index} className="grid gap-4 rounded-lg border p-4 relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-6 w-6 text-red-500 hover:text-red-700"
                      onClick={() => handleRemoveLocation(index)}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Location VB ID</Label>
                        <Input
                          value={loc.vbId || ""}
                          onChange={(e) => handleLocationChange(index, "vbId", e.target.value)}
                          placeholder="LOC-001"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Location Name</Label>
                        <Input
                          value={loc.locationName || ""}
                          onChange={(e) => handleLocationChange(index, "locationName", e.target.value)}
                          placeholder="Main Warehouse"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Street</Label>
                        <Input
                          value={loc.street || ""}
                          onChange={(e) => handleLocationChange(index, "street", e.target.value)}
                          placeholder="123 Main St"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>City</Label>
                        <Input
                          value={loc.city || ""}
                          onChange={(e) => handleLocationChange(index, "city", e.target.value)}
                          placeholder="New York"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>State</Label>
                        <Input
                          value={loc.state || ""}
                          onChange={(e) => handleLocationChange(index, "state", e.target.value)}
                          placeholder="NY"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Zip Code</Label>
                        <Input
                          value={loc.zip || ""}
                          onChange={(e) => handleLocationChange(index, "zip", e.target.value)}
                          placeholder="10001"
                        />
                      </div>
                      <div className="grid gap-2 col-span-2">
                        <Label>Country</Label>
                        <Input
                          value={loc.country || ""}
                          onChange={(e) => handleLocationChange(index, "country", e.target.value)}
                          placeholder="USA"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>Full Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-9"
                          value={loc.fullAddress || ""}
                          onChange={(e) => handleLocationChange(index, "fullAddress", e.target.value)}
                          placeholder="123 Main St, New York, NY, 10001, USA"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Editing this parses to individual fields.</p>
                    </div>

                    <div className="grid gap-2">
                       <Label>Website</Label>
                        <div className="relative">
                        <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-9"
                          value={loc.website || ""}
                          onChange={(e) => handleLocationChange(index, "website", e.target.value)}
                          placeholder="https://example.com"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {formData.location?.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-4 border border-dashed rounded-lg">
                    No locations added.
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:space-x-0">
               <Button variant="outline" type="button" onClick={() => setIsSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingItem ? "Save Changes" : "Create Supplier"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
