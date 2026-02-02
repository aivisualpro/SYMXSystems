"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/admin/image-upload";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { TagInput } from "@/components/admin/tag-input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Hash, Package, Plus, X, Layers, Image as ImageIcon, FileText, Share2 } from "lucide-react";
import { toast } from "sonner";

interface Product {
  _id?: string;
  vbId: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  relatedProducts?: string[];
  tags?: string[];
  costPrice?: number;
  salePrice?: number;
  coverImage?: string;
  primaryImage?: string;
  showCase?: string[];
  otherInfo?: { title: string; tags: string[] }[];
  isOnWebsite?: boolean;
  sNo?: string;
}

interface Category {
  _id: string;
  category: string;
  subcategories: { subcategory: string }[];
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Product | null;
  categories: Category[];
  allProducts: Product[]; // Used for related products selection
  onSuccess: () => void;
}

const defaultFormData: Partial<Product> = {
  vbId: "",
  name: "",
  description: "",
  category: "",
  subcategory: "",
  relatedProducts: [],
  tags: [],
  costPrice: 0,
  salePrice: 0,
  coverImage: "",
  primaryImage: "",
  showCase: [],
  otherInfo: [],
  isOnWebsite: false,
  sNo: ""
};

export function ProductFormDialog({ 
  open, 
  onOpenChange, 
  initialData, 
  categories, 
  allProducts,
  onSuccess 
}: ProductFormDialogProps) {
  const [formData, setFormData] = useState<Partial<Product>>(defaultFormData);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
            ...defaultFormData,
            ...initialData,
            otherInfo: initialData.otherInfo || [],
            relatedProducts: initialData.relatedProducts || [], // Ensure IDs are carried over if simple string array
            // Note: If initialData.relatedProducts contains objects (populated), map to IDs
            // But usually this dialog expects simple ID arrays for editing.
            // We might need to handle populated vs unpopulated if used from detail page.
        });
        
        // Handle populated relatedProducts if coming from Detail Page
        if (initialData.relatedProducts && initialData.relatedProducts.length > 0 && typeof initialData.relatedProducts[0] === 'object') {
             setFormData(prev => ({
                 ...prev,
                 relatedProducts: (initialData.relatedProducts as any[]).map((p: any) => p._id || p)
             }));
        }

      } else {
        setFormData(defaultFormData);
      }
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = initialData?._id
        ? `/api/admin/products/${initialData._id}`
        : "/api/admin/products";
      const method = initialData?._id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success(initialData?._id ? "Product updated" : "Product created");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error("An error occurred saving the product");
      console.error(error);
    }
  };

  // Helper for OtherInfo
  const addOtherInfo = () => {
    setFormData(prev => ({
      ...prev,
      otherInfo: [...(prev.otherInfo || []), { title: "", tags: [] }]
    }));
  };

  const removeOtherInfo = (index: number) => {
    setFormData(prev => ({
      ...prev,
      otherInfo: (prev.otherInfo || []).filter((_, i) => i !== index)
    }));
  };

  const updateOtherInfo = (index: number, field: 'title' | 'tags', value: any) => {
    const newInfo = [...(formData.otherInfo || [])];
    newInfo[index] = { ...newInfo[index], [field]: value };
    setFormData({ ...formData, otherInfo: newInfo });
  };

  // Helper for Related Products Toggle
  const toggleRelatedProduct = (pId: string) => {
    const current = formData.relatedProducts || [];
    if (current.includes(pId)) {
      setFormData({ ...formData, relatedProducts: current.filter(id => id !== pId) });
    } else {
      setFormData({ ...formData, relatedProducts: [...current, pId] });
    }
  };

  const currentId = initialData?._id;

  const [activeSection, setActiveSection] = useState("identity");

  const sections = [
    { id: "identity", label: "Identity", icon: Hash },
    { id: "classification", label: "Classification", icon: Layers },
    { id: "pricing", label: "Pricing & Stock", icon: Package },
    { id: "media", label: "Media Gallery", icon: ImageIcon },
    { id: "extras", label: "Extras & Related", icon: Share2 },
  ];



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden flex flex-col gap-0 outline-none border-none bg-background shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/20">
            <div>
              <DialogTitle className="text-xl font-bold">{initialData?._id ? "Edit Product" : "New Product"}</DialogTitle>
            </div>
            {/* Quick Actions / Save in Header for better UX */}
             <div className="flex gap-2">
                 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                 <Button onClick={handleSubmit}>Save Changes</Button>
             </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border-r bg-muted/10 flex-none overflow-y-auto py-6 space-y-1">
                {sections.map(section => (
                    <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full text-left px-6 py-3 text-sm font-medium transition-all flex items-center gap-3 border-l-4 ${
                            activeSection === section.id 
                            ? "bg-primary/10 text-primary border-primary" 
                            : "text-muted-foreground border-transparent hover:bg-muted/50 hover:text-foreground"
                        }`}
                    >
                        <section.icon className="w-4 h-4" />
                        {section.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-card p-8">
               <div className="max-w-3xl mx-auto space-y-8">
                  {activeSection === "identity" && (
                     <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div>
                           <h2 className="text-lg font-semibold tracking-tight">Product Identity</h2>
                           <Separator className="mt-2" />
                        </div>

                        <div className="space-y-4">
                           {/* Product Name - Taller Input */}
                           <div className="space-y-2">
                              <Label htmlFor="name">Product Name</Label>
                              <textarea
                                id="name"
                                value={formData.name || ""}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-medium resize-none shadow-sm text-lg"
                                placeholder="Enter product name..."
                              />
                           </div>

                           {/* Description - Big Box */}
                            <div className="space-y-2">
                                <Label>Product Description</Label>
                                <RichTextEditor
                                  value={formData.description || ""}
                                  onChange={(html) => setFormData({ ...formData, description: html })}
                                  placeholder="Enter detailed product description..."
                                  className="min-h-[250px]"
                                />
                             </div>

                             {/* Visibility Toggle */}
                             <div className="flex items-center space-x-3 pt-2">
                                <Label htmlFor="isOnWebsite" className="text-base font-medium">Website Visibility</Label>
                                <Switch
                                  id="isOnWebsite"
                                  checked={formData.isOnWebsite}
                                  onCheckedChange={(checked) => setFormData({ ...formData, isOnWebsite: checked })}
                                />
                             </div>
                        </div>
                     </div>
                  )}
                  
                  {/* CLASSIFICATION SECTION */}
                  {activeSection === "classification" && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                         <div>
                           <h2 className="text-lg font-semibold tracking-tight">Classification</h2>
                           <p className="text-sm text-muted-foreground">Organize your product catalog.</p>
                           <Separator className="mt-2" />
                        </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-2">
                              <Label>Category</Label>
                              <Select
                                value={formData.category}
                                onValueChange={(value) => setFormData({ ...formData, category: value, subcategory: "" })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map((cat) => (
                                     <SelectItem key={cat._id} value={cat.category}>{cat.category}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                           </div>
                           
                           <div className="space-y-2">
                              <Label>Subcategory</Label>
                               <Select
                                value={formData.subcategory}
                                onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
                                disabled={!formData.category}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Subcategory" />
                                </SelectTrigger>
                                <SelectContent>
                                   {categories.find(c => c.category === formData.category)?.subcategories?.map((sub, i) => (
                                       <SelectItem key={i} value={sub.subcategory}>{sub.subcategory}</SelectItem>
                                   ))}
                                </SelectContent>
                              </Select>
                           </div>
                         </div>
                         
                         <div className="space-y-2">
                            <Label>Tags / Keywords</Label>
                            <TagInput 
                              value={formData.tags || []} 
                              onChange={(tags) => setFormData({...formData, tags})}
                              placeholder="Add keywords (press enter)..."
                            />
                         </div>
                      </div>
                  )}

                  {/* PRICING SECTION */}
                   {activeSection === "pricing" && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                         <div>
                           <h2 className="text-lg font-semibold tracking-tight">Pricing & Costs</h2>
                           <p className="text-sm text-muted-foreground">Manage financial details.</p>
                           <Separator className="mt-2" />
                        </div>
                         
                         <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <Label htmlFor="costPrice">Cost Price</Label>
                              <div className="relative">
                                 <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                 <Input
                                   id="costPrice"
                                   type="number"
                                   className="pl-7"
                                   value={formData.costPrice || 0}
                                   onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                                 />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="salePrice">Sale Price</Label>
                              <div className="relative">
                                 <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                 <Input
                                   id="salePrice"
                                   type="number"
                                   className="pl-7"
                                   value={formData.salePrice || 0}
                                   onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                                 />
                              </div>
                            </div>
                         </div>
                      </div>
                   )}

                  {/* MEDIA SECTION */}
                   {activeSection === "media" && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                         <div>
                           <h2 className="text-lg font-semibold tracking-tight">Media Gallery</h2>
                           <p className="text-sm text-muted-foreground">Manage product imagery.</p>
                           <Separator className="mt-2" />
                        </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             {/* Primary Image */}
                             <div className="space-y-3">
                                <Label>Primary Image</Label>
                                <div className="aspect-square border-2 border-dashed rounded-xl overflow-hidden bg-muted/10 relative group">
                                    {formData.primaryImage ? (
                                        <ImageUpload 
                                           value={formData.primaryImage}
                                           onChange={(url) => setFormData({...formData, primaryImage: url as string})}
                                           compact
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                                            <ImageIcon className="w-8 h-8 text-muted-foreground/50 mb-2" />
                                            <p className="text-xs text-muted-foreground mb-3">Main thumbnail image</p>
                                             <ImageUpload 
                                               value=""
                                               onChange={(url) => setFormData({...formData, primaryImage: url as string})}
                                               compact
                                            />
                                        </div>
                                    )}
                                </div>
                             </div>
                             
                             {/* Cover Image */}
                              <div className="space-y-3">
                                <Label>Cover Image</Label>
                                <div className="aspect-video md:aspect-square border-2 border-dashed rounded-xl overflow-hidden bg-muted/10 relative group">
                                     <ImageUpload 
                                       value={formData.coverImage || ""}
                                       onChange={(url) => setFormData({...formData, coverImage: url as string})}
                                       compact
                                     />
                                </div>
                             </div>
                         </div>

                         <div className="space-y-3">
                            <Label>Showcase Gallery</Label>
                            <div className="min-h-[150px] border-2 border-dashed rounded-xl bg-muted/5 p-4">
                                <ImageUpload 
                                  value={formData.showCase || []}
                                  onChange={(urls) => setFormData({...formData, showCase: urls as string[]})}
                                  multiple
                                />
                            </div>
                         </div>
                      </div>
                   )}



                   {/* EXTRAS SECTION */}
                   {activeSection === "extras" && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                         
                         {/* Related Products */}
                         <div>
                           <h2 className="text-lg font-semibold tracking-tight">Related Items</h2>
                           <p className="text-sm text-muted-foreground">Link other products to this one.</p>
                           <Separator className="my-2" />
                           <ScrollArea className="h-[200px] w-full border rounded-lg p-3 bg-muted/10">
                              {allProducts.filter(p => !currentId || p._id !== currentId).map((product) => (
                                <div key={product._id} className="flex items-center space-x-3 py-2 border-b last:border-0 border-border/50">
                                  <Checkbox 
                                    id={`rp-${product._id}`} 
                                    checked={(formData.relatedProducts || []).includes(product._id!)}
                                    onCheckedChange={() => toggleRelatedProduct(product._id!)}
                                  />
                                  <label
                                    htmlFor={`rp-${product._id}`}
                                    className="text-sm font-medium leading-none cursor-pointer flex-1"
                                  >
                                    {product.name} <span className="text-muted-foreground text-xs ml-2">({product.vbId})</span>
                                  </label>
                                </div>
                              ))}
                              {allProducts.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No other products available.</p>}
                           </ScrollArea>
                         </div>
                         
                         {/* Other Info Sections */}
                         <div className="space-y-4 pt-4">
                             <div className="flex items-center justify-between">
                               <div>
                                   <h2 className="text-lg font-semibold tracking-tight">Technical Specifications</h2>
                                   <p className="text-sm text-muted-foreground">Add custom specification tables.</p>
                               </div>
                               <Button type="button" variant="outline" size="sm" onClick={addOtherInfo}>
                                 <Plus className="h-4 w-4 mr-2" /> Add Spec
                               </Button>
                             </div>
                             <Separator />
                             
                             <div className="grid gap-4">
                               {formData.otherInfo?.map((info, index) => (
                                  <div key={index} className="space-y-4 border rounded-xl p-4 relative bg-card shadow-sm group">
                                    <Button 
                                      type="button" 
                                      variant="ghost" 
                                      size="icon" 
                                      className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive"
                                      onClick={() => removeOtherInfo(index)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                    <div className="grid gap-3">
                                      <div className="space-y-1">
                                          <Label className="text-xs font-semibold uppercase text-muted-foreground">Section Title</Label>
                                          <Input 
                                             value={info.title}
                                             onChange={(e) => updateOtherInfo(index, 'title', e.target.value)}
                                             placeholder="e.g. Dimensions, Battery, Warranty"
                                             className="font-medium"
                                          />
                                      </div>
                                      <div className="space-y-1">
                                          <Label className="text-xs font-semibold uppercase text-muted-foreground">Values</Label>
                                          <TagInput 
                                             value={info.tags}
                                             onChange={(tags) => updateOtherInfo(index, 'tags', tags)}
                                             placeholder="Add value tags..."
                                          />
                                      </div>
                                    </div>
                                  </div>
                               ))}
                               {(!formData.otherInfo || formData.otherInfo.length === 0) && (
                                   <div className="text-center py-8 border-2 border-dashed rounded-xl bg-muted/10">
                                       <p className="text-sm text-muted-foreground">No specifications added yet.</p>
                                   </div>
                               )}
                             </div>
                         </div>
                      </div>
                   )}

               </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
