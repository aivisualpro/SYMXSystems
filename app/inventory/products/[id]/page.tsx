"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Edit, Tag, Hash, Package, Globe, Star, Image as ImageIcon, Layers, FileText, Share2, Check, ChevronRight, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import Image from "next/image";
import { ProductFormDialog } from "@/components/admin/product-form-dialog";

import { useHeaderActions } from "@/components/providers/header-actions-provider";

interface Product {
  _id: string;
  vbId: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  relatedProducts?: { _id: string; name: string; primaryImage: string; salePrice: number }[];
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

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { setLeftContent, setRightContent } = useHeaderActions();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  // Edit Dialog State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  const [openSection, setOpenSection] = useState<string | null>("details");

  const handleEdit = () => setIsEditOpen(true);

  // Set Global Header Actions
  useEffect(() => {
    // Left: Back Button
    setLeftContent(
       <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 h-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Inventory
       </Button>
    );

    // Right: Edit Button
    setRightContent(
       <Button size="sm" onClick={() => setIsEditOpen(true)} className="h-8">
          <Edit className="w-4 h-4 mr-2" />
          Edit Product
       </Button>
    );

    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [router, setLeftContent, setRightContent]); // setIsEditOpen is stable from useState

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/products/${id}`); 
        if (!response.ok) throw new Error("Failed to fetch product");
        const data = await response.json();
        setProduct(data);
        setActiveImage(data.primaryImage || data.coverImage || null);
      } catch (error) {
        toast.error("Could not load product details");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    const fetchCategories = async () => {
        try {
          const res = await fetch("/api/admin/categories");
          if (res.ok) setCategories(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchAllProducts = async () => {
        try {
          const res = await fetch("/api/admin/products");
          if (res.ok) setAllProducts(await res.json());
        } catch (e) { console.error(e); }
    };

    fetchProduct();
    fetchCategories();
    fetchAllProducts();
  }, [id]);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  if (loading) return <ProductSkeleton />;
  if (!product) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
        <h2 className="text-2xl font-bold">Product Not Found</h2>
        <Button onClick={() => router.back()}>Go Back</Button>
    </div>
  );

  const allImages = [
    product.primaryImage ? { src: product.primaryImage, type: 'Primary' } : null,
    product.coverImage ? { src: product.coverImage, type: 'Cover' } : null,
    ...(product.showCase || []).map(img => ({ src: img, type: 'Showcase' }))
  ].filter(Boolean) as { src: string; type: string }[];

  const benefits = product.tags?.slice(0, 4) || []; 

  return (
    <div className="h-full bg-background pb-20 overflow-y-auto w-full overflow-x-hidden">
       <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
             
             {/* LEFT COLUMN - IMAGES */}
             <div className="space-y-6">
                <div className="relative aspect-square md:aspect-[4/3] lg:aspect-square w-full rounded-3xl overflow-hidden bg-muted/20 border-2 border-transparent shadow-sm group">
                   {activeImage ? (
                     <Image 
                       src={activeImage} 
                       alt={product.name}
                       fill
                       className="object-cover transition-transform duration-700 group-hover:scale-105"
                       priority
                     />
                   ) : (
                     <div className="flex h-full items-center justify-center text-muted-foreground/30">
                       <ImageIcon className="w-24 h-24" />
                     </div>
                   )}
                </div>
                
                {/* Thumbnails */}
                {allImages.length > 1 && (
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {allImages.map((img, idx) => (
                       <button
                         key={idx}
                         onClick={() => setActiveImage(img.src)}
                         className={`relative w-24 h-24 flex-none rounded-2xl overflow-hidden border-2 transition-all ${
                           activeImage === img.src ? "border-primary ring-2 ring-primary/20 scale-95" : "border-transparent opacity-70 hover:opacity-100"
                         }`}
                       >
                          <Image src={img.src} alt="Thumbnail" fill className="object-cover" />
                       </button>
                    ))}
                  </div>
                )}
             </div>

             {/* RIGHT COLUMN - INFO */}
             <div className="flex flex-col space-y-8 min-w-0 w-full">
                
                <div className="space-y-4">
                   {/* Categories as Chips */}
                   <div className="flex flex-wrap items-center gap-2">
                      {product.category && (
                        <Badge className="text-sm px-3 py-1">
                          {product.category}
                        </Badge>
                      )}
                      {product.subcategory && (
                        <Badge variant="secondary" className="text-sm px-3 py-1">
                          {product.subcategory}
                        </Badge>
                      )}
                      {/* Status Chip */}
                      <Badge variant="outline" className={`ml-auto border-transparent ${product.isOnWebsite ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'}`}>
                           {product.isOnWebsite ? 'Website: Visible' : 'Website: Hidden'}
                      </Badge>
                   </div>

                   {/* Title */}
                   <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1] break-words">
                     {product.name}
                   </h1>
                </div>

                {/* Description (Moved Up) */}
                <div className="prose dark:prose-invert max-w-none text-muted-foreground leading-relaxed break-words">
                   {product.description ? (
                      <div dangerouslySetInnerHTML={{ __html: product.description }} />
                   ) : (
                      <p className="italic">No description available.</p>
                   )}
                </div>

                <Separator />

                {/* Tags / Features */}
                {benefits.length > 0 && (
                  <div className="space-y-3">
                     <h3 className="font-semibold text-foreground">Highlights</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                       {benefits.map((tag, i) => (
                         <div key={i} className="flex items-center gap-3">
                            <div className="flex-none w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                               <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground capitalize">{tag}</span>
                         </div>
                       ))}
                     </div>
                  </div>
                )}
                
                {/* Accordions for Extras */}
                {/* Expanded Extras (Always Visible) */}
                {product.otherInfo && product.otherInfo.length > 0 && (
                  <div className="divide-y divide-border pt-4">
                     {product.otherInfo.map((info, idx) => (
                        <div key={idx} className="py-5">
                             <h3 className="text-lg font-semibold text-foreground mb-4">{info.title}</h3>
                             <div className="flex flex-wrap gap-2">
                               {info.tags.map((t, ti) => (
                                 <Badge key={ti} variant="secondary" className="rounded-md px-3 py-1 font-normal">{t}</Badge>
                               ))}
                             </div>
                        </div>
                     ))}
                  </div>
                )}
             </div>

          </div>
       </div>

      <ProductFormDialog 
        open={isEditOpen} 
        onOpenChange={setIsEditOpen} 
        initialData={product as any} 
        categories={categories}
        allProducts={allProducts as any[]}
        onSuccess={() => {
            // Re-fetch product data
            const fetchProduct = async () => {
              if (!id) return;
              try {
                const response = await fetch(`/api/admin/products/${id}`); 
                if (response.ok) setProduct(await response.json());
              } catch (e) { console.error(e); }
            };
            fetchProduct();
        }}
      />
    </div>
  );
}

// Helper Component for Accordion
function AccordionItem({ title, isOpen, onClick, children }: { title: string, isOpen: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <div className="py-4">
      <button 
        onClick={onClick}
        className="flex items-center justify-between w-full py-2 text-left group"
      >
        <span className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">{title}</span>
        {isOpen ? <Minus className="w-5 h-5 text-muted-foreground" /> : <Plus className="w-5 h-5 text-muted-foreground" />}
      </button>
      <div 
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
           {children}
        </div>
      </div>
    </div>
  )
}

function ProductSkeleton() {
  return (
    <div className="h-full bg-background w-full p-8 md:p-12">
       <div className="container mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12">
          <Skeleton className="aspect-square w-full rounded-3xl" />
          <div className="space-y-8">
             <Skeleton className="h-12 w-3/4 rounded-lg" />
             <Skeleton className="h-6 w-1/3 rounded-lg" />
             <div className="space-y-4">
               <Skeleton className="h-14 w-full rounded-full" />
               <Skeleton className="h-12 w-full rounded-full" />
             </div>
             <Skeleton className="h-40 w-full rounded-xl" />
          </div>
       </div>
    </div>
  );
}
