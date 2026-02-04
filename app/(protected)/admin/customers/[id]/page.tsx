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
  Building2, 
  Hash, 
  MapPin, 
  Globe, 
  ExternalLink,
  ChevronRight,
  Pencil,
  Trash,
  ImagePlus,
  ClipboardList,
  Box,
  Truck,
  Calendar,
  Tag,
  ChevronDown,
  User,
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

interface CustomerLocation {
  _id?: string;
  vbId: string;
  locationName: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  fullAddress: string;
  website: string;
  imageUrl?: string;
}

interface Customer {
  _id: string;
  vbId: string;
  name: string;
  location: CustomerLocation[];
}

interface Shipping {
  _id?: string;
  vbpoId?: string;
  vbpoNo?: string;
  parentCpoId?: string;
  parentCpoNo?: string;
  status?: string;
  ETA?: string;
  updatedETA?: string;
  carrier?: string;
  supplierLocation?: string;
  containerNo?: string;
  BOLNumber?: string;
  vessellTrip?: string;
  portOfLading?: string;
  portOfEntryShipTo?: string;
  dateOfLanding?: string;
  drums?: number;
  pallets?: number;
  gallons?: number;
  invValue?: number;
  estTrumpDuties?: number;
  netWeightKG?: number;
  grossWeightKG?: number;
  ticoVB?: number;
  isArrivalNotice?: boolean;
  isGensetRequired?: boolean;
  gensetInv?: string;
  gensetEmailed?: boolean;
  isCollectFeesPaid?: boolean;
  feesAmount?: number;
  estimatedDuties?: number;
  isDOCreated?: boolean;
  isSupplierInvoice?: boolean;
  isManufacturerSecurityISF?: boolean;
  isVidaBuddiesISFFiling?: boolean;
  isPackingList?: boolean;
  isCertificateOfAnalysis?: boolean;
  isCertificateOfOrigin?: boolean;
  IsBillOfLading?: boolean;
  isBillOfLading?: boolean;
  isAllDocumentsProvidedToCustomsBroker?: boolean;
  isCustomsStatus?: boolean;
  IsDrayageAssigned?: boolean;
  truckerNotifiedDate?: string;
  isTruckerReceivedDeliveryOrder?: boolean;
  createdBy?: string;
  updateShipmentTracking?: string;
  _poId: string;
  _cpoIdx: number;
  _shipIdx: number;
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

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Dialog States
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCustomerEditDialogOpen, setIsCustomerEditDialogOpen] = useState(false);
  
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");

  // Data for POs & Shippings
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [supplierLocations, setSupplierLocations] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<Record<string, string>>({});
  const [selectedCpoId, setSelectedCpoId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const { setLeftContent, setRightContent } = useHeaderActions();

  useEffect(() => {
    if (customer) {
      setLeftContent(
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black tracking-tight uppercase bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">{customer.name}</h1>
          <div className="flex gap-2">
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black border border-primary/20">{customer.vbId}</span>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-black border uppercase tracking-tighter">{customer.location?.length || 0} Locations</span>
          </div>
        </div>
      );
      setRightContent(
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="font-bold uppercase tracking-widest text-[10px]" onClick={handleEditDetails}>Edit Details</Button>
          <Button size="sm" className="font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20" onClick={handleAddLocation}>Add Location</Button>
          <Button variant="ghost" size="sm" className="font-bold uppercase tracking-widest text-[10px]" onClick={() => router.back()}>
            <ChevronRight className="h-4 w-4 rotate-180 mr-2" /> Back
          </Button>
        </div>
      );
    }
    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [customer, setLeftContent, setRightContent]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [custRes, poRes, supRes, prodRes, userRes] = await Promise.all([
          fetch(`/api/admin/customers/${id}`).then(r => r.json()),
          fetch("/api/admin/purchase-orders").then(r => r.json()),
          fetch("/api/admin/suppliers").then(r => r.json()),
          fetch("/api/admin/products").then(r => r.json()),
          fetch("/api/admin/users").then(r => r.json()),
        ]);

        setCustomer(custRes);

        if (Array.isArray(poRes)) {
           setPurchaseOrders(poRes);
        }

        if (Array.isArray(userRes)) {
          const mapping: Record<string, string> = {};
          userRes.forEach((u: any) => {
            mapping[u.email.toLowerCase()] = u.name;
          });
          setUsers(mapping);
        }


        if (Array.isArray(supRes)) {
          const mapping: Record<string, string> = {};
          supRes.forEach((sup: any) => {
            if (sup.location && Array.isArray(sup.location)) {
              sup.location.forEach((loc: any) => {
                if (loc.vbId) mapping[loc.vbId] = loc.locationName || `${sup.name} - ${loc.city}`;
              });
            }
          });
          setSupplierLocations(mapping);
        }

        if (Array.isArray(prodRes)) {
          const mapping: Record<string, string> = {};
          prodRes.forEach((p: any) => {
            mapping[p._id] = p.name;
            if (p.vbId) mapping[p.vbId] = p.name;
          });
          setProducts(mapping);
        }
      } catch (error) {
        toast.error("Error loading dashboard data");
      } finally {
        setLoading(false);
        setDataLoading(false);
      }
    };

    fetchInitialData();
  }, [id]);

  const filteredCustomerPOs = purchaseOrders.flatMap(po => 
    (po.customerPO || []).filter(cpo => {
      const matchCust = cpo.customer === customer?.vbId;
      const matchLoc = !selectedLocationId || cpo.customerLocation === selectedLocationId;
      return matchCust && matchLoc;
    }).map(cpo => ({
      ...cpo,
      vbpoId: po._id,
      vbpoNo: po.vbpoNo,
      orderCategory: po.category,
      createdBy: po.createdBy
    }))
  ).sort((a, b) => new Date(b.customerPODate || '').getTime() - new Date(a.customerPODate || '').getTime());


  const allShippings: Shipping[] = filteredCustomerPOs.flatMap(cpo => {
    const po = purchaseOrders.find(p => p._id === cpo.vbpoId);
    const cpoIdx = po?.customerPO.findIndex(c => c._id === cpo._id) ?? -1;
    
    return (cpo.shipping || []).map((ship, sIdx) => ({
      ...ship,
      parentCpoNo: cpo.poNo,
      parentCpoId: cpo._id,
      vbpoNo: cpo.vbpoNo,
      vbpoId: cpo.vbpoId,
      _poId: cpo.vbpoId!,
      _cpoIdx: cpoIdx,
      _shipIdx: sIdx
    }));
  }).sort((a, b) => new Date(b.ETA || '').getTime() - new Date(a.ETA || '').getTime());

  const filteredShippings = selectedCpoId 
    ? allShippings.filter(s => s.parentCpoId === selectedCpoId)
    : allShippings;

  const updateShippingField = async (poId: string, cpoIdx: number, shipIdx: number, field: string, value: any) => {
      if (cpoIdx === -1 || shipIdx === -1) return;

      // Optimistic Update
      setPurchaseOrders(prev => prev.map(p => {
        if (p._id !== poId) return p;
        const newPO = { ...p };
        newPO.customerPO = [...p.customerPO];
        const cpo = { ...newPO.customerPO[cpoIdx] };
        cpo.shipping = [...(cpo.shipping || [])];
        cpo.shipping[shipIdx] = { ...cpo.shipping[shipIdx], [field]: value };
        newPO.customerPO[cpoIdx] = cpo;
        return newPO;
      }));

      try {
        const updateKey = `customerPO.${cpoIdx}.shipping.${shipIdx}.${field}`;
        const response = await fetch(`/api/admin/purchase-orders/${poId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [updateKey]: value })
        });
        
        if (!response.ok) throw new Error("Update failed");
      } catch (error) {
        toast.error("Failed to update");
        // Could refresh if needed
      }
  };


  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, locationId: string) => {
    const file = e.target.files?.[0];
    if (!file || !customer) return;

    setUploadingId(locationId);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const uploadRes = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (uploadData.secure_url) {
        const updatedLocations = customer.location.map((loc, idx) => {
          const currentId = loc._id || idx.toString();
          if (currentId === locationId) {
            return { ...loc, imageUrl: uploadData.secure_url };
          }
          return loc;
        });

        const updateRes = await fetch(`/api/admin/customers/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location: updatedLocations }),
        });

        if (updateRes.ok) {
          const updatedCustomer = await updateRes.json();
          setCustomer(updatedCustomer);
          toast.success("Image updated successfully!");
        }
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload image.");
    } finally {
      setUploadingId(null);
    }
  };

  const handleEditLocation = (locationId: string) => {
    if (!customer) return;
    const location = customer.location.find((l, idx) => (l._id || idx.toString()) === locationId);
    if (!location) return;
    
    setEditingLocationId(locationId);
    setTempName(location.locationName);
    setIsEditDialogOpen(true);
  };

  const confirmEditLocation = async () => {
    if (!customer || !editingLocationId) return;

    try {
      const updatedLocations = customer.location.map((loc, idx) => {
        if ((loc._id || idx.toString()) === editingLocationId) {
          return { ...loc, locationName: tempName };
        }
        return loc;
      });

      const updateRes = await fetch(`/api/admin/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: updatedLocations }),
      });

      if (updateRes.ok) {
        const updatedCustomer = await updateRes.json();
        setCustomer(updatedCustomer);
        toast.success("Location name updated!");
        setIsEditDialogOpen(false);
      }
    } catch (error) {
      toast.error("Failed to update location.");
    }
  };

  const handleDeleteLocation = (locationId: string) => {
    setDeletingLocationId(locationId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteLocation = async () => {
    if (!customer || !deletingLocationId) return;

    try {
      const updatedLocations = customer.location.filter((loc, idx) => (loc._id || idx.toString()) !== deletingLocationId);

      const updateRes = await fetch(`/api/admin/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: updatedLocations }),
      });

      if (updateRes.ok) {
        const updatedCustomer = await updateRes.json();
        setCustomer(updatedCustomer);
        toast.success("Location deleted successfully");
        setIsDeleteDialogOpen(false);
      }
    } catch (error) {
      toast.error("Failed to delete location.");
    }
  };

  const handleAddLocation = async () => {
    if (!customer) return;
    
    const newLocation: CustomerLocation = {
      vbId: `${customer.vbId}-${customer.location.length + 1}`,
      locationName: "New Site " + (customer.location.length + 1),
      street: "123 New St",
      city: "City",
      state: "ST",
      country: "Country",
      zip: "00000",
      fullAddress: "123 New St, City, ST 00000, Country",
      website: "https://example.com"
    };

    try {
      const updatedLocations = [...customer.location, newLocation];
      const updateRes = await fetch(`/api/admin/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: updatedLocations }),
      });

      if (updateRes.ok) {
        const updatedCustomer = await updateRes.json();
        setCustomer(updatedCustomer);
        toast.success("New location added!");
      }
    } catch (error) {
      toast.error("Failed to add location.");
    }
  };

  const handleEditDetails = () => {
    if (!customer) return;
    setTempName(customer.name);
    setIsCustomerEditDialogOpen(true);
  };

  const confirmEditCustomer = async () => {
    if (!customer || !tempName || tempName === customer.name) {
      setIsCustomerEditDialogOpen(false);
      return;
    }

    try {
      const updateRes = await fetch(`/api/admin/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tempName }),
      });

      if (updateRes.ok) {
        setCustomer({ ...customer, name: tempName });
        toast.success("Customer name updated!");
        setIsCustomerEditDialogOpen(false);
      }
    } catch (error) {
      toast.error("Failed to update customer details.");
    }
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (!customer) {
    return <div className="p-8 text-center">Customer not found</div>;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-hidden relative bg-transparent">
        {/* Global Page Background Pattern Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] dark:opacity-[0.02] overflow-hidden">
           <img 
             src="/images/nano_banana_bg.png" 
             alt="" 
             className="w-full h-full object-cover scale-150 rotate-1 rounded-full"
           />
        </div>

        <div className="grid grid-cols-12 gap-[8px] p-0 h-full overflow-hidden relative z-10">
        {/* Column 1: Locations */}
        <div className="col-span-2 flex flex-col gap-[8px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
          <div className="sticky top-0 z-20 flex items-center justify-between p-[8px] mb-[4px] backdrop-blur-xl border-b border-border/20 bg-transparent">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Locations</span>
            </div>
          </div>

          <div className="space-y-[8px]">
            {customer.location && customer.location.length > 0 ? (
              customer.location.map((loc: CustomerLocation, idx) => (
                <div 
                  key={loc._id || idx} 
                  onClick={() => setSelectedLocationId(selectedLocationId === loc.vbId ? null : loc.vbId)}
                  className={cn(
                    "group relative h-60 overflow-hidden rounded-3xl border shadow-none transition-all duration-500 hover:-translate-y-2 cursor-pointer",
                    selectedLocationId === loc.vbId ? "border-primary ring-1 ring-primary bg-primary/10" : "border-border hover:border-primary/40 bg-transparent"
                  )}
                >
                  {/* Nano Banana Background Image - Better visibility for Light Theme */}
                  <img 
                    src="/images/nano_banana_bg.png" 
                    alt="Background" 
                    className="absolute inset-0 w-full h-full object-cover opacity-[0.10] dark:opacity-30 group-hover:scale-110 transition-transform duration-700 pointer-events-none"
                  />
                  

                  {/* Main Content Area - 3 Row Structure */}
                  <div className="absolute inset-0 p-[8px] flex flex-col justify-end gap-[4px] z-10">
                    <div className="space-y-1">
                      {/* 1st Row: Location Name */}
                      <h3 className="text-lg font-black leading-tight text-foreground uppercase tracking-tight">
                        {loc.locationName || "Unnamed"}
                      </h3>
                      
                      {/* 2nd Row: vbId */}
                      <div className="inline-flex px-1.5 py-0.5 rounded-md border border-foreground/5">
                        <span className="text-[9px] font-black tracking-[0.1em] text-muted-foreground/80 uppercase">
                          {loc.vbId || 'Active Site'}
                        </span>
                      </div>
                      
                      {/* 3rd Row: Full Address */}
                      <p className="text-muted-foreground text-[9px] font-bold leading-tight line-clamp-3 max-w-[95%] uppercase tracking-wide pt-1">
                        {loc.fullAddress || `${loc.street}, ${loc.city}, ${loc.country}`}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">


                      {/* Action Row with Tooltips */}
                      <div className="flex gap-[8px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((loc.fullAddress || `${loc.street}, ${loc.city}, ${loc.country}`).replace(/\|/g, ' '))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-none border border-primary/20"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-black text-white border-white/10 font-black uppercase text-[10px] tracking-widest">Directions</TooltipContent>
                        </Tooltip>

                        {loc.website && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a 
                                href={(loc.website.startsWith('http') ? loc.website : `https://${loc.website}`).split('|')[0].trim()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-none border border-primary/20"
                              >
                                <Globe className="h-3.5 w-3.5" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-black text-white border-white/10 font-black uppercase text-[10px] tracking-widest">Website</TooltipContent>
                          </Tooltip>
                        )}

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              onClick={(e) => { e.stopPropagation(); handleEditLocation(loc._id || idx.toString()); }}
                              className="h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-none border border-primary/20 p-0"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-black text-white border-white/10 font-black uppercase text-[10px] tracking-widest">Edit Site</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              onClick={(e) => { e.stopPropagation(); handleDeleteLocation(loc._id || idx.toString()); }}
                              className="h-8 w-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-none border border-destructive/20 p-0"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-black text-white border-white/10 font-black uppercase text-[10px] tracking-widest">Delete Site</TooltipContent>
                        </Tooltip>
                      </div>

                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 border border-dashed rounded-lg font-black uppercase text-xs tracking-widest text-muted-foreground opacity-50">
                No locations registered
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Customer POs */}
        <div className="col-span-3 flex flex-col gap-[8px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
          <div className="sticky top-0 z-20 flex items-center justify-between p-[8px] mb-[4px] backdrop-blur-xl border-b border-border/20 bg-transparent">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Order History</span>
            </div>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black border border-primary/20">
              {filteredCustomerPOs.length}
            </span>
          </div>

          <div className="space-y-[8px]">
            {filteredCustomerPOs.length > 0 ? (
              filteredCustomerPOs.map((cpo, idx) => {
                const poLocations: Record<string, string> = {};
                customer.location.forEach(l => { poLocations[l.vbId] = l.locationName; });

                return (
                <div 
                  key={cpo._id || idx} 
                  onClick={() => setSelectedCpoId(selectedCpoId === cpo._id ? null : cpo._id || null)}
                  className={cn(
                    "group relative overflow-hidden rounded-3xl text-card-foreground border shadow-none transition-all duration-500 hover:-translate-y-1 hover:border-primary/40 p-[8px] cursor-pointer",
                    selectedCpoId === cpo._id ? "border-primary ring-1 ring-primary bg-primary/10" : "border-border bg-transparent"
                  )}
                >
                  {/* Background Nano Banana Gradient & Pattern */}
                  {/* Background Accents Removed */}
                  <img 
                    src="/images/nano_banana_bg.png" 
                    alt="bg" 
                    className="absolute inset-0 w-full h-full object-cover opacity-[0.15] dark:opacity-40 mix-blend-multiply dark:mix-blend-overlay group-hover:scale-110 transition-all duration-1000 pointer-events-none"
                  />
                  
                  <div className="relative z-10 flex flex-col gap-[8px]">
                    {/* Row 1: poNo and customerPONo (Inline) */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-black leading-tight text-foreground uppercase tracking-tight">
                          {cpo.poNo || "UNNAMED"}
                        </h3>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-border/50">
                          <span className="text-[9px] font-black tracking-widest text-muted-foreground uppercase opacity-60">REF:</span>
                          <span className="text-[9px] font-black tracking-widest text-foreground uppercase">
                            {cpo.customerPONo || '-'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                         <Button 
                           size="icon" 
                           variant="ghost" 
                           className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                           onClick={(e) => { 
                               e.stopPropagation(); 
                               router.push(`/admin/purchase-orders/${cpo.vbpoId}`);
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
                               toast.info("Delete customer PO from Purchase Orders detail page");
                           }}
                         >
                            <Trash className="h-3.5 w-3.5" />
                         </Button>
                      </div>
                    </div>

                    <Separator className="bg-border/30" />

                    {/* Row 2: Site Location (Resolved Name) */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        <p className="text-[12px] font-bold uppercase tracking-tight text-foreground/90 truncate">
                          {poLocations[cpo.customerLocation || ""] || cpo.customerLocation || "Generic Site"}
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
                    <div className="grid grid-cols-3 gap-[8px] rounded-2xl p-[8px] border border-border/50">
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
                      
                      <div className="flex flex-col items-end">
                          <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest opacity-50">VBPO</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                             {cpo.vbpoNo}
                          </p>
                      </div>
                    </div>
                  </div>
                </div>
              )})
            ) : (

              <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-[2.5rem] opacity-50">
                <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-4" />
                <p className="font-black uppercase text-[10px] tracking-[0.3em] text-muted-foreground">No Purchase History</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Shippings */}
        <div className="col-span-7 flex flex-col gap-[8px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
          <div className="sticky top-0 z-20 flex items-center justify-between p-[8px] mb-[4px] backdrop-blur-xl border-b border-border/20 bg-transparent">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Active Logistics</span>
            </div>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black border border-primary/20">
              {filteredShippings.length}
            </span>
          </div>

          <div className="space-y-[8px]">
            {filteredShippings.length > 0 ? (
              filteredShippings.map((ship, idx) => (
                <div key={idx} className="relative overflow-hidden rounded-3xl text-card-foreground border border-border shadow-sm p-[8px] space-y-[8px] bg-transparent">
                    {/* Background Pattern */}
                    {/* Background Accents Removed */}
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
                            onClick={() => router.push(`/admin/purchase-orders/${ship.vbpoId}`)}
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
                                toast.info("Delete shipping from Purchase Orders detail page");
                            }}
                        >
                            <Trash className="h-3 w-3" />
                        </Button>
                    </div>

                    {/* Row 1: VBID | Container | BOL | Status */}

                    <div className="grid grid-cols-4 gap-4 relative z-10">
                        <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-70">VBID</p>
                            <p className="text-sm font-bold">{ship.svbid || ship.vbpoNo}</p>
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
                    <div className="grid grid-cols-3 gap-[8px] rounded-2xl p-[8px] border border-border/50 relative z-10">
                        <div className="flex flex-col items-center gap-1 text-center">
                            <MapPin className="h-4 w-4 text-primary/60" />
                            <p className="text-[10px] font-black text-foreground truncate w-full px-1" title={(ship.supplierLocation ? supplierLocations[ship.supplierLocation as string] : undefined) || ship.supplierLocation}>
                                {(ship.supplierLocation ? supplierLocations[ship.supplierLocation as string] : undefined) || ship.supplierLocation || 'N/A'}
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
                    <div className="rounded-2xl border border-border/50 relative z-10 flex flex-col">
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
                    <div className="rounded-2xl border border-border/50 relative z-10 flex flex-col mt-4">
                         {/* Row 1: Product Info */}
                         <div className="grid grid-cols-5 gap-0 p-2">
                            {/* Product (Wider) */}
                            <div className="col-span-2 flex flex-col items-center justify-center text-center border-r border-border/50 px-2 py-1">
                                 <p className="text-[11px] font-black text-foreground truncate w-full" title={(ship.product ? products[ship.product as string] : undefined) || ship.product}>
                                    {(ship.product ? products[ship.product as string] : undefined) || ship.product || 'UNKNOWN PRODUCT'}
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
                    <div className="rounded-2xl border border-border/50 relative z-10 flex flex-col mt-4">
                        
                        {/* Grid Row 1: Arrival | Genset | Fees */}
                        <div className="grid grid-cols-5 gap-0 p-2 border-b border-border/30">
                             {/* Arrival Notice */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Arrival Notice</p>
                                <Switch 
                                  checked={!!ship.isArrivalNotice} 
                                  onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'isArrivalNotice', v)} 
                                  className="scale-75 data-[state=checked]:bg-primary cursor-pointer" 
                                />
                            </div>
                            {/* Genset Req */}
                            <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Genset Req</p>
                                <Switch checked={!!ship.isGensetRequired} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'isGensetRequired', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
                            </div>
                            {/* Genset Inv */}
                            <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1 pt-1.5">
                                <p className="text-[10px] font-bold text-foreground truncate w-full">{ship.gensetInv || '-'}</p>
                                <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Genset Inv</p>
                            </div>
                             {/* Genset Emailed */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Genset Emailed</p>
                                <Switch checked={!!ship.gensetEmailed} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'gensetEmailed', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
                            </div>
                             {/* Collect Fees */}
                             <div className="flex flex-col items-center gap-1.5 text-center px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Collect Fees</p>
                                <Switch checked={!!ship.isCollectFeesPaid} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'isCollectFeesPaid', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
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
                                <Switch checked={!!ship.isDOCreated} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'isDOCreated', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
                            </div>
                             {/* Sup Inv */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Sup Inv</p>
                                <Switch checked={!!ship.isSupplierInvoice} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'isSupplierInvoice', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
                            </div>
                             {/* Man Sec ISF */}
                             <div className="flex flex-col items-center gap-1.5 text-center px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Man Sec ISF</p>
                                <Switch checked={!!ship.isManufacturerSecurityISF} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'isManufacturerSecurityISF', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
                            </div>
                        </div>

                        {/* Grid Row 3: Docs B */}
                        <div className="grid grid-cols-5 gap-0 p-2 border-b border-border/30">
                             {/* VB ISF */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">VB ISF</p>
                                <Switch checked={!!ship.isVidaBuddiesISFFiling} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'isVidaBuddiesISFFiling', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
                            </div>
                             {/* Pack List */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Pack List</p>
                                <Switch checked={!!ship.isPackingList} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'isPackingList', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
                            </div>
                             {/* Cert Analysis */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Cert Analysis</p>
                                <Switch checked={!!ship.isCertificateOfAnalysis} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'isCertificateOfAnalysis', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
                            </div>
                             {/* Cert Origin */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Cert Origin</p>
                                <Switch checked={!!ship.isCertificateOfOrigin} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'isCertificateOfOrigin', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
                            </div>
                             {/* Bill of Lading */}
                             <div className="flex flex-col items-center gap-1.5 text-center px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Bill of Lading</p>
                                <Switch checked={!!ship.IsBillOfLading || !!ship.isBillOfLading} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'IsBillOfLading', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
                            </div>
                        </div>

                        {/* Grid Row 4: Final Status & Logistics */}
                        <div className="grid grid-cols-5 gap-0 p-2">
                             {/* Docs to Broker */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Docs to Broker</p>
                                <Switch checked={!!ship.isAllDocumentsProvidedToCustomsBroker} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'isAllDocumentsProvidedToCustomsBroker', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
                            </div>
                             {/* Customs Stat */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Customs Stat</p>
                                <Switch checked={!!ship.isCustomsStatus} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'isCustomsStatus', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
                            </div>
                             {/* Drayage Asg */}
                             <div className="flex flex-col items-center gap-1.5 text-center border-r border-border/50 px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Drayage Asg</p>
                                <Switch checked={!!ship.IsDrayageAssigned} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'IsDrayageAssigned', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
                            </div>
                             {/* Trucker Notif */}
                             <div className="flex flex-col items-center gap-1 text-center border-r border-border/50 px-1 pt-1.5">
                                <p className="text-[9px] font-bold text-foreground truncate w-full">{formatDate(ship.truckerNotifiedDate)}</p>
                                <p className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">Trucker Notif</p>
                            </div>
                             {/* Trucker DO */}
                             <div className="flex flex-col items-center gap-1.5 text-center px-1">
                                <p className="text-[9px] font-black uppercase text-muted-foreground">Trucker DO</p>
                                <Switch checked={!!ship.isTruckerReceivedDeliveryOrder} onCheckedChange={(v) => updateShippingField(ship._poId, ship._cpoIdx, ship._shipIdx, 'isTruckerReceivedDeliveryOrder', v)} className="scale-75 data-[state=checked]:bg-primary cursor-pointer" />
                            </div>
                        </div>
                    </div>

                    {/* Row 13: Meta */}
                    <div className="flex items-center justify-between pt-4 relative z-10 border-t border-border/30">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Created By</p>
                                <p className="text-[10px] font-bold uppercase">{ship.createdBy ? (users[ship.createdBy.toLowerCase()] || ship.createdBy) : 'System'}</p>
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

              <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-[2.5rem] opacity-50">
                <Truck className="h-10 w-10 text-muted-foreground/30 mb-4" />
                <p className="font-black uppercase text-[10px] tracking-[0.3em] text-muted-foreground">No Active Ships</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Location Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-primary/20 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Location Name</DialogTitle>
            <DialogDescription className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">
              Update the name for this site.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Location Name</Label>
              <Input
                id="name"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="rounded-2xl bg-foreground/5 border-border focus-visible:ring-primary h-12 text-sm font-bold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="rounded-full font-black uppercase text-[10px] tracking-widest">Cancel</Button>
            <Button onClick={confirmEditLocation} className="rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-destructive/20 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-destructive">Delete Site?</DialogTitle>
            <DialogDescription className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">
              This action cannot be undone. This will permanently remove the site.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-full font-black uppercase text-[10px] tracking-widest">Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteLocation} className="rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg shadow-destructive/20">Confirm Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={isCustomerEditDialogOpen} onOpenChange={setIsCustomerEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-primary/20 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Customer Name</DialogTitle>
            <DialogDescription className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">
              Update the main registration name.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="custName" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Customer Name</Label>
              <Input
                id="custName"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="rounded-2xl bg-foreground/5 border-border focus-visible:ring-primary h-12 text-sm font-bold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCustomerEditDialogOpen(false)} className="rounded-full font-black uppercase text-[10px] tracking-widest">Cancel</Button>
            <Button onClick={confirmEditCustomer} className="rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">Update Name</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </TooltipProvider>
  );
}
