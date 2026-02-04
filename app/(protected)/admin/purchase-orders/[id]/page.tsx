"use client";

import { useEffect, useState, use } from "react";
import { DetailPageSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { 
  ArrowLeft, 
  ShoppingCart, 
  Hash, 
  Calendar, 
  Tag, 
  User,
  ChevronRight,
  Pencil,
  Trash,
  Box,
  MapPin,
  ClipboardList,
  ChevronDown,
  Truck,
  ChevronLeft,
  Plus
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

interface Shipping {
  _id?: string;
  spoNo?: string;
  status?: string;
  ETA?: string;
  carrier?: string;
  [key: string]: any;
}

interface CustomerPO {
  _id?: string;
  poNo?: string;
  customer?: string;
  customerLocation?: string;
  customerPONo?: string;
  customerPODate?: string;
  requestedDeliveryDate?: string;
  qtyOrdered?: number;
  qtyReceived?: number;
  UOM?: string;
  warehouse?: string;
  shipping?: Shipping[];
}

interface PurchaseOrder {
  _id: string;
  vbpoNo: string;
  orderType: string;
  date: string;
  category: string;
  createdBy: string;
  customerPO: CustomerPO[];
}

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [supplierLocations, setSupplierLocations] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Record<string, string>>({});
  const [selectedCpoId, setSelectedCpoId] = useState<string | null>(null);
  
  // Action States
  const [isAddCPOOpen, setIsAddCPOOpen] = useState(false);
  const [editingCPO, setEditingCPO] = useState<{ idx: number, data: any } | null>(null);
  const [addingShippingToCPO, setAddingShippingToCPO] = useState<{ idx: number, poNo: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [actionsVisible, setActionsVisible] = useState(false); // Helper if needed
  const [editingShipping, setEditingShipping] = useState<{ cpoIdx: number, shipIdx: number, data: any } | null>(null);

  const { setLeftContent, setRightContent } = useHeaderActions();

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/admin/customers");
      const data = await response.json();
      if (Array.isArray(data)) {
        const mapping: Record<string, string> = {};
        data.forEach((cust: any) => {
          if (cust.location && Array.isArray(cust.location)) {
            cust.location.forEach((loc: any) => {
              if (loc.vbId) {
                mapping[loc.vbId] = loc.locationName || loc.vbId;
              }
            });
          }
        });
        setLocations(mapping);
      }
    } catch (error) {
      console.error("Failed to fetch customers", error);
    }
  };

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

  const fetchPO = async () => {
    try {
      const response = await fetch(`/api/admin/purchase-orders/${id}`);
      if (!response.ok) throw new Error("Failed to fetch purchase order");
      const data = await response.json();
      setPO(data);
    } catch (error) {
      toast.error("Error loading purchase order details");
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/admin/suppliers");
      const data = await response.json();
      if (Array.isArray(data)) {
        const mapping: Record<string, string> = {};
        data.forEach((sup: any) => {
            if (sup.location && Array.isArray(sup.location)) {
                sup.location.forEach((loc: any) => {
                    if (loc.vbId) {
                        mapping[loc.vbId] = loc.locationName || `${sup.name} - ${loc.city}` || loc.vbId;
                    }
                });
            }
        });
        setSupplierLocations(mapping);
      }
    } catch (error) {
      console.error("Failed to fetch suppliers", error);
    }
  };

  const fetchProducts = async () => {
      try {
        const response = await fetch("/api/admin/products");
        const data = await response.json();
        if (Array.isArray(data)) {
          const mapping: Record<string, string> = {};
          data.forEach((p: any) => {
             mapping[p._id] = p.name;
             if (p.vbId) mapping[p.vbId] = p.name;
          });
          setProducts(mapping);
        }
      } catch (error) {
        console.error("Failed to fetch products", error);
      }
  };

  useEffect(() => {
    fetchPO();
    fetchUsers();
    fetchCustomers();
    fetchSuppliers();
    fetchProducts();
  }, [id]);

  // Calculate total shippings
  const allShippings = po?.customerPO?.flatMap((cpo, cpoIdx) => 
    (cpo.shipping || []).map((ship: any, shipIdx) => ({ 
      ...ship, 
      parentCpoNo: cpo.poNo, 
      parentCpoId: cpo._id,
      _cpoIdx: cpoIdx,
      _shipIdx: shipIdx
    }))
  ) || [];

  const filteredShippings = selectedCpoId 
    ? allShippings.filter((s: any) => s.parentCpoId === selectedCpoId)
    : allShippings;

  const updateShippingField = async (cpoIdx: number, shipIdx: number, field: string, value: any) => {
      // Optimistic Update
      if (!po) return;
      
      const newPO = { ...po };
      if (newPO.customerPO[cpoIdx]?.shipping?.[shipIdx]) {
         newPO.customerPO[cpoIdx].shipping[shipIdx] = {
             ...newPO.customerPO[cpoIdx].shipping[shipIdx],
             [field]: value
         };
         setPO(newPO);
      }

      try {
        const updateKey = `customerPO.${cpoIdx}.shipping.${shipIdx}.${field}`;
        const response = await fetch(`/api/admin/purchase-orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [updateKey]: value })
        });
        
        if (!response.ok) throw new Error("Update failed");
        
        // Quietly success or toast
        // toast.success("Updated successfully");
      } catch (error) {
        toast.error("Failed to update");
        // Revert (could fetchPO() to be safe)
        fetchPO();
      }
  };

  const handleDeleteCPO = (cpoId: string, idx: number) => {
    toast("Delete Customer PO?", {
        description: "Click 'Delete' to confirm. This cannot be undone.",
        action: {
            label: "Delete",
            onClick: async () => {
                setPO((currentPO) => {
                    if (!currentPO) return currentPO;
                    const newCPOs = [...currentPO.customerPO];
                    // Ensure we are deleting the correct index or find by ID if safe
                    // For now, trusting index as per original logic, but finding by ID is safer for robustness
                    const realIdx = newCPOs.findIndex(c => c._id === cpoId);
                    if (realIdx !== -1) {
                         newCPOs.splice(realIdx, 1);
                         return { ...currentPO, customerPO: newCPOs };
                    }
                    return currentPO;
                });

                try {
                    const response = await fetch(`/api/admin/purchase-orders/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            $pull: { customerPO: { _id: cpoId } } 
                        })
                    });

                    if (!response.ok) throw new Error("Failed to delete");
                    toast.success("Customer PO deleted");
                    fetchPO(); 
                } catch (e) {
                    toast.error("Error deleting Customer PO");
                    fetchPO(); // Revert/Refresh
                }
            }
        }
    });
  };

  const handleSaveCPO = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    
    // Basic formatting
    const formattedData: any = { ...data };
    if (formattedData.qtyOrdered) formattedData.qtyOrdered = Number(formattedData.qtyOrdered);
    if (formattedData.qtyReceived) formattedData.qtyReceived = Number(formattedData.qtyReceived);

    try {
        let body = {};
        if (editingCPO) {
             // Update specific fields using dot notation
             const updateObj: any = {};
             Object.keys(formattedData).forEach(key => {
                 updateObj[`customerPO.${editingCPO.idx}.${key}`] = formattedData[key];
             });
             body = updateObj;
        } else {
             // Add new
             body = { $push: { customerPO: formattedData } };
        }

        const response = await fetch(`/api/admin/purchase-orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error("Failed to save");
        
        toast.success(editingCPO ? "Customer PO Updated" : "Customer PO Added");
        setIsAddCPOOpen(false);
        setEditingCPO(null);
        fetchPO();
    } catch (e) {
        toast.error("Error saving Customer PO");
    } finally {
        setActionLoading(false);
    }
  };

  const handleDeleteShipping = (shipId: string, cpoIdx: number, shipIdx: number) => {
     toast("Delete Shipping Record?", {
         description: "Click 'Delete' to confirm. This action cannot be undone.",
         action: {
             label: "Delete",
             onClick: async () => {
                 setPO((currentPO) => {
                     if(!currentPO) return currentPO;
                     // We need to find the correct CPO and Shipping index as they might have shifted
                     // Logic: Find CPO by index (or ID if we had it easily passed), then find shipping by ID
                     const newCPOs = [...currentPO.customerPO];
                     // Fallback to finding CPO by looking into the sub-docs? 
                     // Trusting passed indices for optimistic, but let's try to be safer if possible.
                     // Since we have shipId, we can find it.
                     
                     if (newCPOs[cpoIdx]?.shipping) {
                         const targetShipIdx = newCPOs[cpoIdx].shipping.findIndex((s: any) => s._id === shipId);
                         if(targetShipIdx !== -1) {
                             newCPOs[cpoIdx].shipping.splice(targetShipIdx, 1);
                             return { ...currentPO, customerPO: newCPOs };
                         }
                     }
                     // If not found by ID, maybe try the passed index?
                     if (newCPOs[cpoIdx]?.shipping?.[shipIdx]?._id === shipId) {
                         newCPOs[cpoIdx].shipping.splice(shipIdx, 1);
                         return { ...currentPO, customerPO: newCPOs };
                     }
                     
                     return currentPO;
                 });

                 try {
                     const response = await fetch(`/api/admin/purchase-orders/${id}`, {
                         method: 'PUT',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({ 
                             $pull: { [`customerPO.${cpoIdx}.shipping`]: { _id: shipId } } 
                         })
                     });

                     if (!response.ok) throw new Error("Failed to delete shipping");
                     toast.success("Shipping deleted");
                     fetchPO();
                 } catch (e) {
                     toast.error("Error deleting shipping");
                     fetchPO();
                 }
             }
         }
     });
  };

  const handleSaveShipping = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!addingShippingToCPO && !editingShipping) return;
      
      setActionLoading(true);
      const formData = new FormData(e.target as HTMLFormElement);
      const data = Object.fromEntries(formData.entries());
      const formattedData: any = { ...data };
      if (!editingShipping) formattedData.status = 'Ordered'; // Default status for new
      
      // Numbers
      ['drums', 'pallets', 'gallons', 'netWeightKG', 'grossWeightKG', 'invValue', 'estTrumpDuties', 'feesAmount', 'estimatedDuties', 'qty'].forEach(k => {
          if (formattedData[k]) formattedData[k] = Number(formattedData[k]);
      });

      try {
        let body = {};
        if (editingShipping) {
             const updateObj: any = {};
             Object.keys(formattedData).forEach(key => {
                 updateObj[`customerPO.${editingShipping.cpoIdx}.shipping.${editingShipping.shipIdx}.${key}`] = formattedData[key];
             });
             body = updateObj;
        } else if (addingShippingToCPO) {
             body = { $push: { [`customerPO.${addingShippingToCPO.idx}.shipping`]: formattedData } };
        }

        const response = await fetch(`/api/admin/purchase-orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error("Failed to save shipping");
        
        toast.success(editingShipping ? "Shipping Updated" : "Shipping Added");
        setAddingShippingToCPO(null);
        setEditingShipping(null);
        fetchPO();
      } catch(e) {
        toast.error("Error saving shipping");
      } finally {
        setActionLoading(false);
      }
  };


  // Update Header with Actions
  useEffect(() => {
    if (!po) return;

    setLeftContent(
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold leading-none uppercase bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">{po.vbpoNo}</h1>
            <span className="text-sm text-muted-foreground font-medium uppercase tracking-tight">{po.orderType}</span>
            <span className="text-sm text-gray-300">•</span>
            <span className="text-sm text-muted-foreground font-medium uppercase tracking-tight">{po.category}</span>
          </div>
        </div>
    );

    setRightContent(
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => toast.info("Edit Purchase Order")}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Edit
            </Button>
           <Button variant="outline" size="sm" className="h-8" onClick={() => setIsAddCPOOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-2" />
              Add Customer PO
           </Button>
        </div>
    );

    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [po, users, setLeftContent, setRightContent, router]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (!po) {
    return <div className="p-8 text-center uppercase font-black tracking-[0.2em] text-muted-foreground">Order not found</div>;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-background overflow-hidden relative">
        {/* Global Page Background Pattern Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-multiply dark:mix-blend-overlay overflow-hidden">
           <img 
             src="/images/nano_banana_bg.png" 
             alt="" 
             className="w-full h-full object-cover scale-150 rotate-1 rounded-full opacity-60"
           />
        </div>

        <div className="grid grid-cols-10 gap-6 p-0 h-full relative z-10">
          
          {/* Column 1: Customer POs (Left Side) - 30% */}
          <div className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Customer POs</span>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black border border-primary/20">
                {po.customerPO?.length || 0}
              </span>
            </div>

            <div className="space-y-4">
              {po.customerPO && po.customerPO.length > 0 ? (
                po.customerPO.map((cpo, idx) => (
                  <div 
                    key={cpo._id || idx} 
                    onClick={() => setSelectedCpoId(selectedCpoId === cpo._id ? null : cpo._id || null)}
                    className={cn(
                      "group relative overflow-hidden rounded-3xl bg-card/60 backdrop-blur-sm text-card-foreground border shadow-none transition-all duration-500 hover:-translate-y-1 hover:border-primary/40 p-6 cursor-pointer",
                      selectedCpoId === cpo._id ? "border-primary ring-1 ring-primary bg-primary/5" : "border-border"
                    )}
                  >
                    {/* Background Nano Banana Gradient & Pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-40 group-hover:opacity-100 transition-opacity duration-1000" />
                    <img 
                      src="/images/nano_banana_bg.png" 
                      alt="bg" 
                      className="absolute inset-0 w-full h-full object-cover opacity-[0.15] dark:opacity-40 mix-blend-multiply dark:mix-blend-overlay group-hover:scale-110 transition-all duration-1000 pointer-events-none"
                    />
                    
                    <div className="relative z-10 flex flex-col gap-4">
                      {/* Row 1: poNo and customerPONo (Inline) */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-black leading-tight text-foreground uppercase tracking-tight">
                            {cpo.poNo || "UNNAMED"}
                          </h3>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted/40 rounded-lg border border-border/50">
                            <span className="text-[9px] font-black tracking-widest text-muted-foreground uppercase opacity-60">REF:</span>
                            <span className="text-[9px] font-black tracking-widest text-foreground uppercase">
                              {cpo.customerPONo || '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Separator className="bg-border/30" />

                      {/* Row 2: Site Location (Resolved Name) */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          <p className="text-[12px] font-bold uppercase tracking-tight text-foreground/90 truncate">
                            {locations[cpo.customerLocation || ""] || cpo.customerLocation || "Generic Site"}
                          </p>
                        </div>
                      </div>

                      {/* Row 3: Dates */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] opacity-70">PO Date</p>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-primary/70" />
                            <p className="text-[11px] font-bold text-foreground/80">{formatDate(cpo.customerPODate)}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] opacity-70">Requested</p>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-primary" />
                            <p className="text-[11px] font-bold text-foreground">{formatDate(cpo.requestedDeliveryDate)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Row 4: Icons with qtyOrdered, qtyReceived, UOM */}
                      <div className="grid grid-cols-3 gap-2 bg-muted/30 dark:bg-foreground/5 rounded-2xl p-3 border border-border/50">
                        <div className="flex flex-col items-center gap-1">
                           <Box className="h-4 w-4 text-primary/60" />
                           <p className="text-[11px] font-black text-foreground">{cpo.qtyOrdered || 0}</p>
                           <p className="text-[8px] font-black uppercase text-muted-foreground/60">Ordered</p>
                        </div>
                        <div className="flex flex-col items-center gap-1 border-x border-border/50">
                           <Truck className="h-4 w-4 text-primary" />
                            <p className="text-[11px] font-black text-foreground">{cpo.qtyReceived || 0}</p>
                           <p className="text-[8px] font-black uppercase text-muted-foreground/60">Received</p>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                           <Hash className="h-4 w-4 text-primary/60" />
                           <p className="text-[11px] font-black text-foreground">{cpo.UOM || 'EA'}</p>
                           <p className="text-[8px] font-black uppercase text-muted-foreground/60">Units</p>
                        </div>
                      </div>

                      {/* Row 5: Warehouse & Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                           <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Box className="h-4 w-4 text-primary" />
                           </div>
                           <div className="flex flex-col">
                              <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest opacity-50">Dispatch Point</p>
                              <p className="text-[10px] font-black uppercase tracking-widest text-foreground">
                                 {cpo.warehouse || "STANDBY"}
                              </p>
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                           <Button 
                             size="icon" 
                             variant="ghost" 
                             className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                             onClick={(e) => { 
                                 e.stopPropagation(); 
                                 setEditingCPO({ idx, data: cpo });
                             }}
                           >
                              <Pencil className="h-3.5 w-3.5" />
                           </Button>
                           <Button 
                             size="icon" 
                             variant="ghost" 
                             className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                             onClick={(e) => { 
                                 e.stopPropagation(); 
                                 if (cpo._id) handleDeleteCPO(cpo._id, idx);
                             }}
                           >
                              <Trash className="h-3.5 w-3.5" />
                           </Button>
                           <Button 
                             size="sm" 
                             variant="secondary" 
                             className="h-7 px-3 text-[10px] font-bold uppercase tracking-wide ml-1"
                             onClick={(e) => { 
                                 e.stopPropagation(); 
                                 setAddingShippingToCPO({ idx, poNo: cpo.poNo || '' });
                             }}
                           >
                              <Plus className="h-3 w-3 mr-1.5" />
                              Add Ship
                           </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-[2.5rem] bg-accent/5 opacity-50">
                  <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-4" />
                  <p className="font-black uppercase text-[10px] tracking-[0.3em] text-muted-foreground">No Customer POs</p>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Shippings (Right Side) - 70% */}
          <div className="col-span-7 flex flex-col gap-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Shippings</span>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black border border-primary/20">
                {filteredShippings.length || 0}
              </span>
            </div>

             <div className="space-y-4">
               {filteredShippings.length > 0 ? (
                 filteredShippings.map((ship: any, idx) => (
                  <div key={idx} className="relative overflow-hidden rounded-3xl bg-card/60 backdrop-blur-sm text-card-foreground border border-border shadow-sm p-6 space-y-4">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-40 pointer-events-none" />
                    <img 
                      src="/images/nano_banana_bg.png" 
                      alt="bg" 
                      className="absolute inset-0 w-full h-full object-cover opacity-[0.10] mix-blend-multiply dark:mix-blend-overlay group-hover:scale-110 transition-all duration-1000 pointer-events-none"
                    />

                    {/* Actions: Edit/Delete (Top Right) */}
                    <div className="absolute top-5 right-5 z-20 flex items-center gap-1">
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={() => setEditingShipping({ cpoIdx: ship._cpoIdx, shipIdx: ship._shipIdx, data: ship })}
                        >
                            <Pencil className="h-3 w-3" />
                        </Button>
                        <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteShipping(ship._id, ship._cpoIdx, ship._shipIdx);
                            }}
                        >
                            <Trash className="h-3 w-3" />
                        </Button>
                    </div>
                    
                    {/* Row 1: VBID | Container | BOL | Status */}
                    <div className="grid grid-cols-4 gap-4 relative z-10">
                        <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-70">VBID</p>
                            <p className="text-sm font-bold">{ship.svbid || po.vbpoNo}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-70">Container</p>
                            <p className="text-sm font-bold uppercase">{ship.containerNo || '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-70">BOL Number</p>
                            <p className="text-sm font-bold uppercase">{ship.BOLNumber || '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-70">Status</p>
                            <p className="text-sm font-bold uppercase">{ship.status || 'Active'}</p>
                        </div>
                    </div>

                    <Separator className="bg-border/30 relative z-10" />

                    {/* Row 2: Supplier Info Grid */}
                    <div className="grid grid-cols-3 gap-2 bg-muted/30 dark:bg-foreground/5 rounded-2xl p-3 border border-border/50 relative z-10">
                        <div className="flex flex-col items-center gap-1 text-center">
                            <MapPin className="h-4 w-4 text-primary/60" />
                            <p className="text-[10px] font-black text-foreground truncate w-full px-1" title={supplierLocations[ship.supplierLocation] || ship.supplierLocation}>
                                {supplierLocations[ship.supplierLocation] || ship.supplierLocation || '-'}
                            </p>
                            <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Supplier Loc</p>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center border-x border-border/50">
                            <Hash className="h-4 w-4 text-primary" />
                            <p className="text-[11px] font-black text-foreground truncate w-full px-1">
                                {ship.supplierPO || '-'}
                            </p>
                            <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Supplier PO</p>
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center">
                            <Calendar className="h-4 w-4 text-primary/60" />
                            <p className="text-[11px] font-black text-foreground">
                                {formatDate(ship.supplierPoDate)}
                            </p>
                            <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">PO Date</p>
                        </div>
                    </div>

                    {/* Row 3 & 4: Logistics & Timeline */}
                    <div className="bg-muted/30 dark:bg-foreground/5 rounded-2xl border border-border/50 relative z-10 flex flex-col">
                        <div className="grid grid-cols-3 gap-2 p-3">
                            <div className="flex flex-col items-center gap-1 text-center">
                                <Truck className="h-4 w-4 text-primary/60" />
                                <p className="text-[10px] font-black text-foreground truncate w-full px-1" title={ship.carrier}>
                                    {ship.carrier || '-'}
                                </p>
                                <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Carrier</p>
                            </div>
                            <div className="flex flex-col items-center gap-1 text-center border-x border-border/50">
                                <Tag className="h-4 w-4 text-primary" />
                                <p className="text-[11px] font-black text-foreground truncate w-full px-1" title={ship.carrierBookingRef}>
                                    {ship.carrierBookingRef || '-'}
                                </p>
                                <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Booking Ref</p>
                            </div>
                            <div className="flex flex-col items-center gap-1 text-center">
                                <Box className="h-4 w-4 text-primary/60" />
                                <p className="text-[11px] font-black text-foreground truncate w-full px-1" title={ship.vessellTrip}>
                                    {ship.vessellTrip || '-'}
                                </p>
                                <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Vessel / Trip</p>
                            </div>
                        </div>

                        <Separator className="bg-border/30" />

                        <div className="grid grid-cols-5 gap-0 p-2">
                            <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                                <MapPin className="h-3.5 w-3.5 text-primary/60" />
                                <p className="text-[9px] font-black text-foreground truncate w-full" title={ship.portOfLading}>{ship.portOfLading || '-'}</p>
                                <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Lading</p>
                            </div>
                            <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                                <MapPin className="h-3.5 w-3.5 text-primary/60" />
                                <p className="text-[9px] font-black text-foreground truncate w-full" title={ship.portOfEntryShipTo}>{ship.portOfEntryShipTo || '-'}</p>
                                <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Entry</p>
                            </div>
                            <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                                <Calendar className="h-3.5 w-3.5 text-primary/60" />
                                <p className="text-[9px] font-black text-foreground truncate w-full">{formatDate(ship.dateOfLanding)}</p>
                                <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Landing</p>
                            </div>
                            <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                                <Calendar className="h-3.5 w-3.5 text-primary/60" />
                                <p className="text-[9px] font-black text-foreground truncate w-full">{formatDate(ship.ETA)}</p>
                                <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">ETA</p>
                            </div>
                            <div className="flex flex-col items-center gap-1 text-center px-1">
                                <Calendar className="h-3.5 w-3.5 text-primary" />
                                <p className="text-[9px] font-black text-foreground truncate w-full">{formatDate(ship.updatedETA)}</p>
                                <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Upd ETA</p>
                            </div>
                        </div>
                    </div>

                    <Separator className="bg-border/30 relative z-10" />

                    {/* Row 4: Cargo & Financials Card */}
                    <div className="bg-muted/30 dark:bg-foreground/5 rounded-2xl border border-border/50 relative z-10 flex flex-col mt-4">
                         {/* Row 1: Product Info */}
                         <div className="grid grid-cols-5 gap-0 p-2">
                            {/* Product (Wider) */}
                            <div className="col-span-2 flex flex-col items-center justify-center text-center border-r border-border/50 px-2 py-1">
                                <p className="text-[10px] font-black text-foreground whitespace-normal break-words leading-tight" title={products[ship.product] || ship.product}>
                                    {products[ship.product] || ship.product || '-'}
                                </p>
                            </div>
                            {/* Drums */}
                            <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                                <Box className="h-3.5 w-3.5 text-primary/60" />
                                <p className="text-[9px] font-black text-foreground truncate w-full">{ship.drums || 0}</p>
                                <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Drums</p>
                            </div>
                             {/* Pallets */}
                             <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                                <Box className="h-3.5 w-3.5 text-primary/60" />
                                <p className="text-[9px] font-black text-foreground truncate w-full">{ship.pallets || 0}</p>
                                <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Pallets</p>
                            </div>
                             {/* Gallons */}
                             <div className="flex flex-col items-center gap-1 text-center px-1">
                                <Box className="h-3.5 w-3.5 text-primary/60" />
                                <p className="text-[9px] font-black text-foreground truncate w-full">{ship.gallons || 0}</p>
                                <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Gallons</p>
                            </div>
                        </div>

                        <Separator className="bg-border/30" />

                        {/* Row 2: Values & Weights */}
                        <div className="grid grid-cols-5 gap-0 p-2">
                            {/* Inv Value */}
                            <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                                <Hash className="h-3.5 w-3.5 text-primary/60" />
                                <p className="text-[9px] font-black text-foreground truncate w-full">${ship.invValue || 0}</p>
                                <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Inv Value</p>
                            </div>
                            {/* Est. Duties */}
                            <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                                <Hash className="h-3.5 w-3.5 text-primary/60" />
                                <p className="text-[9px] font-black text-foreground truncate w-full">${ship.estTrumpDuties || 0}</p>
                                <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Est. Duties</p>
                            </div>
                            {/* Net KG */}
                            <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                                <Box className="h-3.5 w-3.5 text-primary/60" />
                                <p className="text-[9px] font-black text-foreground truncate w-full">{ship.netWeightKG || 0}</p>
                                <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Net KG</p>
                            </div>
                            {/* Gross KG */}
                            <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1">
                                <Box className="h-3.5 w-3.5 text-primary/60" />
                                <p className="text-[9px] font-black text-foreground truncate w-full">{ship.grossWeightKG || 0}</p>
                                <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Gross KG</p>
                            </div>
                            {/* Tico VB */}
                            <div className="flex flex-col items-center gap-1 text-center px-1">
                                <Tag className="h-3.5 w-3.5 text-primary" />
                                <p className="text-[9px] font-black text-foreground truncate w-full">{ship.ticoVB || '-'}</p>
                                <p className="text-[7px] font-black uppercase text-muted-foreground/60 tracking-widest">Tico VB</p>
                            </div>
                        </div>
                    </div>

                    {/* Row 5: Logistics & Documentation Master Grid */}
                    <div className="bg-muted/30 dark:bg-foreground/5 rounded-2xl border border-border/50 relative z-10 flex flex-col mt-4">
                        
                        {/* Grid Row 1: Arrival | Genset | Fees */}
                        <div className="grid grid-cols-5 gap-0 p-2 border-b border-border/30">
                             {/* Arrival Notice */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Arrival Notice</p>
                                <Switch checked={!!ship.isArrivalNotice} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isArrivalNotice', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                            {/* Genset Req */}
                            <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Genset Req</p>
                                <Switch checked={!!ship.isGensetRequired} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isGensetRequired', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                            {/* Genset Inv */}
                            <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1 pt-1.5">
                                <p className="text-[10px] font-bold text-foreground truncate w-full">{ship.gensetInv || '-'}</p>
                                <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Genset Inv</p>
                            </div>
                             {/* Genset Emailed */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Genset Emailed</p>
                                <Switch checked={!!ship.gensetEmailed} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'gensetEmailed', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                             {/* Collect Fees */}
                             <div className="flex flex-col items-center gap-1.5 text-center px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Collect Fees</p>
                                <Switch checked={!!ship.isCollectFeesPaid} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isCollectFeesPaid', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                        </div>

                        {/* Grid Row 2: Financials | DO | Docs A */}
                        <div className="grid grid-cols-5 gap-0 p-2 border-b border-border/30">
                            {/* Amount */}
                            <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1 pt-1.5">
                                <p className="text-[10px] font-bold text-foreground">${ship.feesAmount || 0}</p>
                                <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Amount</p>
                            </div>
                             {/* Est Duties */}
                             <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1 pt-1.5">
                                <p className="text-[10px] font-bold text-foreground">${ship.estimatedDuties || 0}</p>
                                <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Est Duties</p>
                            </div>
                             {/* DO Created */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">DO Created</p>
                                <Switch checked={!!ship.isDOCreated} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isDOCreated', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                             {/* Sup Inv */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Sup Inv</p>
                                <Switch checked={!!ship.isSupplierInvoice} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isSupplierInvoice', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                             {/* Man Sec ISF */}
                             <div className="flex flex-col items-center gap-1.5 text-center px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Man Sec ISF</p>
                                <Switch checked={!!ship.isManufacturerSecurityISF} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isManufacturerSecurityISF', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                        </div>

                        {/* Grid Row 3: Docs B */}
                        <div className="grid grid-cols-5 gap-0 p-2 border-b border-border/30">
                             {/* VB ISF */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">VB ISF</p>
                                <Switch checked={!!ship.isVidaBuddiesISFFiling} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isVidaBuddiesISFFiling', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                             {/* Pack List */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Pack List</p>
                                <Switch checked={!!ship.isPackingList} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isPackingList', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                             {/* Cert Analysis */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Cert Analysis</p>
                                <Switch checked={!!ship.isCertificateOfAnalysis} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isCertificateOfAnalysis', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                             {/* Cert Origin */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Cert Origin</p>
                                <Switch checked={!!ship.isCertificateOfOrigin} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isCertificateOfOrigin', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                             {/* Bill of Lading */}
                             <div className="flex flex-col items-center gap-1.5 text-center px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Bill of Lading</p>
                                <Switch checked={!!ship.IsBillOfLading || !!ship.isBillOfLading} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'IsBillOfLading', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                        </div>

                         {/* Grid Row 4: Final Status & Logistics */}
                        <div className="grid grid-cols-5 gap-0 p-2">
                             {/* Docs to Broker */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Docs to Broker</p>
                                <Switch checked={!!ship.isAllDocumentsProvidedToCustomsBroker} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isAllDocumentsProvidedToCustomsBroker', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                             {/* Customs Stat */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Customs Stat</p>
                                <Switch checked={!!ship.isCustomsStatus} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isCustomsStatus', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                             {/* Drayage Asg */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Drayage Asg</p>
                                <Switch checked={!!ship.IsDrayageAssigned} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'IsDrayageAssigned', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                             {/* Trucker Notif */}
                             <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1 pt-1.5">
                                <p className="text-[9px] font-bold text-foreground truncate w-full">{formatDate(ship.truckerNotifiedDate)}</p>
                                <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Trucker Notif</p>
                            </div>
                             {/* Trucker DO */}
                             <div className="flex flex-col items-center gap-1.5 text-center px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Trucker DO</p>
                                <Switch checked={!!ship.isTruckerReceivedDeliveryOrder} onCheckedChange={(v) => updateShippingField(ship._cpoIdx, ship._shipIdx, 'isTruckerReceivedDeliveryOrder', v)} className="scale-75 data-[state=checked]:bg-primary" />
                            </div>
                        </div>

                    </div>

                    {/* Row 13: Meta & Actions */}
                    <div className="flex items-center justify-between pt-4 relative z-10 border-t border-border/30">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Created By</p>
                                <p className="text-[10px] font-bold uppercase">{users[po.createdBy?.toLowerCase()] || po.createdBy || 'System'}</p>
                            </div>
                            
                            </div>
                        
                        <div className="flex flex-col items-end max-w-[50%]">
                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Tracking Log</p>
                            <p className="text-[10px] font-bold uppercase truncate">{ship.updateShipmentTracking || '-'}</p>
                        </div>
                    </div>
                  </div>
                 ))
               ) : (
                 <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-[2.5rem] bg-accent/5 opacity-50">
                    <Truck className="h-10 w-10 text-muted-foreground/30 mb-4" />
                    <p className="font-black uppercase text-[10px] tracking-[0.3em] text-muted-foreground">No Shipments Recorded</p>
                 </div>
               )}
             </div>

          </div>
        </div>
      </div>
      <Dialog open={isAddCPOOpen || !!editingCPO} onOpenChange={(v) => { if(!v) { setIsAddCPOOpen(false); setEditingCPO(null); } }}>
        <DialogContent>
           <DialogHeader>
              <DialogTitle>{editingCPO ? "Edit Customer PO" : "Add Customer PO"}</DialogTitle>
              <DialogDescription>Enter the details for this order division.</DialogDescription>
           </DialogHeader>
           <form onSubmit={handleSaveCPO} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <Label>PO Number (Internal)</Label>
                      <Input name="poNo" defaultValue={editingCPO?.data?.poNo} required placeholder="e.g. VB310-1" />
                  </div>
                  <div className="space-y-1">
                      <Label>Customer Ref</Label>
                      <Input name="customerPONo" defaultValue={editingCPO?.data?.customerPONo} placeholder="e.g. AC00084" />
                  </div>
                  <div className="space-y-1">
                      <Label>Customer Location</Label>
                      <select name="customerLocation" className="w-full border rounded-md h-9 px-3 text-sm bg-background" defaultValue={editingCPO?.data?.customerLocation}>
                         <option value="">Select Location</option>
                         {Object.entries(locations).map(([id, name]) => (
                             <option key={id} value={id}>{name}</option>
                         ))}
                      </select>
                  </div>
                  <div className="space-y-1">
                      <Label>Dispatch / Warehouse</Label>
                      <Input name="warehouse" defaultValue={editingCPO?.data?.warehouse} placeholder="Warehouse Name" />
                  </div>
                  <div className="space-y-1">
                      <Label>PO Date</Label>
                      <Input name="customerPODate" type="date" defaultValue={editingCPO?.data?.customerPODate ? new Date(editingCPO.data.customerPODate).toISOString().split('T')[0] : ''} />
                  </div>
                  <div className="space-y-1">
                      <Label>Requested Delivery</Label>
                      <Input name="requestedDeliveryDate" type="date" defaultValue={editingCPO?.data?.requestedDeliveryDate ? new Date(editingCPO.data.requestedDeliveryDate).toISOString().split('T')[0] : ''} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                       <div className="space-y-1"><Label>Qty Ordered</Label><Input name="qtyOrdered" type="number" defaultValue={editingCPO?.data?.qtyOrdered} /></div>
                       <div className="space-y-1"><Label>Received</Label><Input name="qtyReceived" type="number" defaultValue={editingCPO?.data?.qtyReceived} /></div>
                  </div>
                   <div className="space-y-1"><Label>UOM</Label><Input name="UOM" defaultValue={editingCPO?.data?.UOM} /></div>
              </div>
              <DialogFooter>
                 <Button type="button" variant="outline" onClick={() => { setIsAddCPOOpen(false); setEditingCPO(null); }}>Cancel</Button>
                 <Button type="submit" disabled={actionLoading}>{actionLoading ? "Saving..." : "Save Changes"}</Button>
              </DialogFooter>
           </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!addingShippingToCPO || !!editingShipping} onOpenChange={(v) => { if(!v) { setAddingShippingToCPO(null); setEditingShipping(null); } }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingShipping ? "Edit Shipping Record" : "Add Shipping Record"}</DialogTitle>
                <DialogDescription>
                    {editingShipping ? "Update shipment details" : `Adding shipment to PO: ${addingShippingToCPO?.poNo}`}
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveShipping} className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
                  
                  {/* --- Core Info --- */}
                  <div className="md:col-span-2">
                     <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-3 border-b pb-1">Core Information</h4>
                  </div>

                  <div className="space-y-1">
                      <Label>Product</Label>
                       <select name="product" className="w-full border rounded-md h-9 px-3 text-sm bg-background" defaultValue={editingShipping?.data?.product}>
                         <option value="">Select Product</option>
                         {Object.entries(products).map(([id, name]) => (
                             <option key={id} value={id}>{name}</option>
                         ))}
                      </select>
                  </div>
                  <div className="space-y-1">
                      <Label>Status</Label>
                      <Input name="status" placeholder="e.g. Ordered, Shipped..." defaultValue={editingShipping?.data?.status || 'Ordered'} />
                  </div>
                  <div className="space-y-1">
                      <Label>VBID</Label>
                      <Input name="svbid" placeholder="Auto-generated if empty" defaultValue={editingShipping?.data?.svbid} />
                  </div>
                  <div className="space-y-1">
                      <Label>Container No</Label>
                      <Input name="containerNo" placeholder="ABCD1234567" defaultValue={editingShipping?.data?.containerNo} />
                  </div>
                  <div className="space-y-1">
                      <Label>BOL Number</Label>
                      <Input name="BOLNumber" placeholder="Bill of Lading No" defaultValue={editingShipping?.data?.BOLNumber} />
                  </div>
                  <div className="space-y-1">
                       <Label>Tico VB</Label>
                       <Input name="ticoVB" placeholder="Tico VB ref" defaultValue={editingShipping?.data?.ticoVB} />
                  </div>

                  {/* --- Supplier --- */}
                  <div className="md:col-span-2 mt-2">
                     <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-3 border-b pb-1">Supplier Details</h4>
                  </div>

                  <div className="space-y-1">
                      <Label>Supplier Location</Label>
                       <select name="supplierLocation" className="w-full border rounded-md h-9 px-3 text-sm bg-background" defaultValue={editingShipping?.data?.supplierLocation}>
                         <option value="">Select Location</option>
                         {Object.entries(supplierLocations).map(([id, name]) => (
                             <option key={id} value={id}>{name}</option>
                         ))}
                      </select>
                  </div>
                  <div className="space-y-1">
                      <Label>Supplier PO</Label>
                      <Input name="supplierPO" placeholder="Supplier Ref" defaultValue={editingShipping?.data?.supplierPO} />
                  </div>
                  <div className="space-y-1">
                      <Label>Supplier PO Date</Label>
                      <Input name="supplierPoDate" type="date" defaultValue={editingShipping?.data?.supplierPoDate ? new Date(editingShipping.data.supplierPoDate).toISOString().split('T')[0] : ''} />
                  </div>

                  {/* --- Logistics --- */}
                  <div className="md:col-span-2 mt-2">
                     <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-3 border-b pb-1">Logistics & Shipping</h4>
                  </div>

                  <div className="space-y-1">
                      <Label>Carrier</Label>
                      <Input name="carrier" placeholder="Carrier Name" defaultValue={editingShipping?.data?.carrier} />
                  </div>
                   <div className="space-y-1">
                      <Label>Booking Ref</Label>
                      <Input name="carrierBookingRef" placeholder="Booking Ref" defaultValue={editingShipping?.data?.carrierBookingRef} />
                  </div>
                  <div className="space-y-1">
                      <Label>Vessel / Trip</Label>
                      <Input name="vessellTrip" placeholder="Vessel Name / Trip No" defaultValue={editingShipping?.data?.vessellTrip} />
                  </div>
                  <div className="space-y-1">
                      <Label>Port of Lading</Label>
                      <Input name="portOfLading" placeholder="Port Name" defaultValue={editingShipping?.data?.portOfLading} />
                  </div>
                  <div className="space-y-1">
                      <Label>Port of Entry</Label>
                      <Input name="portOfEntryShipTo" placeholder="Port Name" defaultValue={editingShipping?.data?.portOfEntryShipTo} />
                  </div>
                  <div className="space-y-1">
                      <Label>Landing Date</Label>
                      <Input name="dateOfLanding" type="date" defaultValue={editingShipping?.data?.dateOfLanding ? new Date(editingShipping.data.dateOfLanding).toISOString().split('T')[0] : ''} />
                  </div>
                  <div className="space-y-1">
                      <Label>ETA</Label>
                      <Input name="ETA" type="date" defaultValue={editingShipping?.data?.ETA ? new Date(editingShipping.data.ETA).toISOString().split('T')[0] : ''} />
                  </div>
                  <div className="space-y-1">
                      <Label>Updated ETA</Label>
                      <Input name="updatedETA" type="date" defaultValue={editingShipping?.data?.updatedETA ? new Date(editingShipping.data.updatedETA).toISOString().split('T')[0] : ''} />
                  </div>
                  <div className="space-y-1">
                      <Label>Trucker Notified</Label>
                      <Input name="truckerNotifiedDate" type="date" defaultValue={editingShipping?.data?.truckerNotifiedDate ? new Date(editingShipping.data.truckerNotifiedDate).toISOString().split('T')[0] : ''} />
                  </div>

                   {/* --- Weights & Measures --- */}
                  <div className="md:col-span-2 mt-2">
                     <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-3 border-b pb-1">Weights & Measures</h4>
                  </div>

                   <div className="space-y-1">
                      <Label>Drums</Label>
                      <Input name="drums" type="number" defaultValue={editingShipping?.data?.drums} />
                  </div>
                   <div className="space-y-1">
                      <Label>Pallets</Label>
                      <Input name="pallets" type="number" defaultValue={editingShipping?.data?.pallets} />
                  </div>
                  <div className="space-y-1">
                      <Label>Gallons</Label>
                      <Input name="gallons" type="number" defaultValue={editingShipping?.data?.gallons} />
                  </div>
                  <div className="space-y-1">
                      <Label>Net Weight (KG)</Label>
                      <Input name="netWeightKG" type="number" defaultValue={editingShipping?.data?.netWeightKG} />
                  </div>
                  <div className="space-y-1">
                      <Label>Gross Weight (KG)</Label>
                      <Input name="grossWeightKG" type="number" defaultValue={editingShipping?.data?.grossWeightKG} />
                  </div>

                   {/* --- Financials --- */}
                  <div className="md:col-span-2 mt-2">
                     <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-3 border-b pb-1">Financials</h4>
                  </div>

                  <div className="space-y-1">
                      <Label>Invoice Value ($)</Label>
                      <Input name="invValue" type="number" step="0.01" defaultValue={editingShipping?.data?.invValue} />
                  </div>
                  <div className="space-y-1">
                      <Label>Fees Amount ($)</Label>
                      <Input name="feesAmount" type="number" step="0.01" defaultValue={editingShipping?.data?.feesAmount} />
                  </div>
                  <div className="space-y-1">
                      <Label>Est. Regular Duties ($)</Label>
                      <Input name="estimatedDuties" type="number" step="0.01" defaultValue={editingShipping?.data?.estimatedDuties} />
                  </div>
                  <div className="space-y-1">
                      <Label>Est. Trump Duties ($)</Label>
                      <Input name="estTrumpDuties" type="number" step="0.01" defaultValue={editingShipping?.data?.estTrumpDuties} />
                  </div>
                   <div className="space-y-1">
                      <Label>Genset Invoice #</Label>
                      <Input name="gensetInv" placeholder="Invoice #" defaultValue={editingShipping?.data?.gensetInv} />
                  </div>

                   {/* --- Inventory Details (New) --- */}
                   <div className="md:col-span-2 mt-2">
                      <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-3 border-b pb-1">Inventory Details</h4>
                   </div>
                   <div className="space-y-1">
                       <Label>Item No</Label>
                       <Input name="itemNo" placeholder="Item Code" defaultValue={editingShipping?.data?.itemNo} />
                   </div>
                   <div className="space-y-1">
                       <Label>Lot / Serial</Label>
                       <Input name="lotSerial" placeholder="Lot No" defaultValue={editingShipping?.data?.lotSerial} />
                   </div>
                   <div className="md:col-span-2 space-y-1">
                       <Label>Description</Label>
                       <Input name="description" placeholder="Item Description" defaultValue={editingShipping?.data?.description} />
                   </div>
                   <div className="space-y-1">
                       <Label>Quantity</Label>
                       <Input name="qty" type="number" defaultValue={editingShipping?.data?.qty} />
                   </div>
                   <div className="space-y-1">
                       <Label>Type</Label>
                       <Input name="type" placeholder="e.g. Stock, Transit" defaultValue={editingShipping?.data?.type} />
                   </div>
                   <div className="space-y-1">
                       <Label>Inventory Date</Label>
                       <Input name="inventoryDate" type="date" defaultValue={editingShipping?.data?.inventoryDate ? new Date(editingShipping.data.inventoryDate).toISOString().split('T')[0] : ''} />
                   </div>

                   {/* --- Other --- */}
                  <div className="md:col-span-2 mt-2">
                     <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-3 border-b pb-1">Tracking Log</h4>
                  </div>
                   <div className="md:col-span-2 space-y-1">
                      <Label>Log Notes</Label>
                      <Input name="updateShipmentTracking" placeholder="Tracking updates..." defaultValue={editingShipping?.data?.updateShipmentTracking} />
                  </div>

               </div>
               <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setAddingShippingToCPO(null); setEditingShipping(null); }}>Cancel</Button>
                  <Button type="submit" disabled={actionLoading}>{actionLoading ? "Saving..." : (editingShipping ? "Update Shipping" : "Add Shipping")}</Button>
               </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

    </TooltipProvider>
  );
}
