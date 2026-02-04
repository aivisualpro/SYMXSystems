"use client";

import { useEffect, useState } from "react";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash, Plus, X, GripVertical } from "lucide-react";
import { ImageUpload } from "@/components/admin/image-upload";
import { Badge } from "@/components/ui/badge";
import { TablePageSkeleton } from "@/components/skeletons";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SubCategory {
  id: string; // Used for UI keying (DND)
  _id?: string; // MongoDB ID
  subcategory: string;
  icon?: string;
  isOnWebsite: boolean;
}

interface Category {
  _id: string;
  category: string;
  isOnWebsite: boolean;
  subcategories: SubCategory[];
}

const defaultFormData: Partial<Category> = {
  category: "",
  isOnWebsite: false,
  subcategories: []
};

// Sortable Row Component
function SortableSubcategoryRow({ 
  sub, 
  index, 
  updateSubcategory, 
  removeSubcategory 
}: { 
  sub: SubCategory; 
  index: number; 
  updateSubcategory: (index: number, field: keyof SubCategory, value: any) => void; 
  removeSubcategory: (index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sub.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.6 : 1,
    position: 'relative' as 'relative',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-12 gap-4 items-center bg-white p-[2px] rounded-lg border shadow-sm group hover:border-primary/30 transition-all"
    >
      {/* 1. Drag & S.No & Name */}
      <div className="col-span-6 flex items-center gap-3 pl-2">
        <div {...attributes} {...listeners} className="cursor-grab hover:text-primary text-gray-400 touch-none active:cursor-grabbing p-1">
          <GripVertical className="h-5 w-5" />
        </div>
        <span className="text-xs font-mono text-gray-500 w-6 text-center shrink-0">
          {(index + 1).toString().padStart(2, '0')}
        </span>
        <Input
          value={sub.subcategory}
          onChange={(e) => updateSubcategory(index, "subcategory", e.target.value)}
          placeholder="Subcategory Name"
          className="h-9 text-sm flex-1 border-none shadow-none focus-visible:ring-0 bg-transparent px-0"
        />
      </div>

      {/* 2. Image */}
      <div className="col-span-3 flex justify-center py-1">
        <div className="h-16 w-16 relative bg-gray-50 rounded-md border border-dashed border-gray-200 overflow-hidden flex items-center justify-center">
          <ImageUpload
            value={sub.icon || ""}
            onChange={(url) => updateSubcategory(index, "icon", url)}
            compact
          />
        </div>
      </div>

      {/* 3. Visibility & Actions */}
      <div className="col-span-3 flex items-center justify-end gap-3">
         <Switch
            checked={sub.isOnWebsite}
            onCheckedChange={(checked) => updateSubcategory(index, "isOnWebsite", checked)}
            className="scale-90"
          />
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50"
          onClick={() => removeSubcategory(index)}
        >
          <Trash className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}


export default function CategoriesPage() {
  const [data, setData] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit/Add Sheet State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Category | null>(null);

  // View Details Sheet State
  const [viewingItem, setViewingItem] = useState<Category | null>(null);

  const [formData, setFormData] = useState<Partial<Category>>(defaultFormData);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/categories");
      const items = await response.json();
      if (Array.isArray(items)) {
        setData(items);
      }
    } catch (error) {
      toast.error("Failed to fetch categories");
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
        ? `/api/admin/categories/${editingItem._id}`
        : "/api/admin/categories";
      const method = editingItem ? "PUT" : "POST";

      const cleanData = {
        ...formData,
        subcategories: formData.subcategories?.map(({ id, ...rest }) => rest)
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success(editingItem ? "Category updated" : "Category created");
      setIsSheetOpen(false);
      fetchItems();
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent row click
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Category deleted");
      if (viewingItem?._id === id) setViewingItem(null);
      fetchItems();
    } catch (error) {
      toast.error("Failed to delete category");
    }
  };

  const handleStatusToggle = async (item: Category, checked: boolean) => {
    // Optimistic update
    setData(prev => prev.map(c => c._id === item._id ? { ...c, isOnWebsite: checked } : c));
    
    try {
       const response = await fetch(`/api/admin/categories/${item._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, isOnWebsite: checked }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      toast.success("Status updated");
    } catch (error) {
       toast.error("Failed to update status");
       fetchItems(); // Revert on error
    }
  }

  const handleSubcategoryToggle = async (category: Category, subIndex: number, checked: boolean) => {
    if (!category) return;
    
    const newSubcategories = [...category.subcategories];
    newSubcategories[subIndex] = { ...newSubcategories[subIndex], isOnWebsite: checked };
    const updatedCategory = { ...category, subcategories: newSubcategories };

    // Optimistic update
    setData(prev => prev.map(c => c._id === category._id ? updatedCategory : c));
    setViewingItem(updatedCategory);

    try {
      const response = await fetch(`/api/admin/categories/${category._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedCategory),
      });
      if (!response.ok) throw new Error("Failed");
      toast.success("Subcategory status updated");
    } catch (error) {
        toast.error("Failed to update status");
        fetchItems(); 
    }
  }

  const openAddSheet = () => {
    setEditingItem(null);
    setFormData({
      ...defaultFormData,
      subcategories: []
    });
    setIsSheetOpen(true);
  };

  const openEditSheet = (item: Category, e?: React.MouseEvent) => {
    e?.stopPropagation(); 
    setEditingItem(item);
    // Ensure all subcategories have a UI ID
    setFormData({
      ...item,
      subcategories: (item.subcategories || []).map(sub => ({
        ...sub,
        id: sub._id || crypto.randomUUID()
      }))
    });
    setIsSheetOpen(true);
  };

  // Subcategory Helpers
  const addSubcategory = () => {
    setFormData(prev => ({
      ...prev,
      subcategories: [
        ...(prev.subcategories || []), 
        { 
          id: crypto.randomUUID(), 
          subcategory: "", 
          isOnWebsite: false, 
          icon: "" 
        }
      ]
    }));
  };

  const removeSubcategory = (index: number) => {
    setFormData(prev => ({
      ...prev,
      subcategories: (prev.subcategories || []).filter((_, i) => i !== index)
    }));
  };

  const updateSubcategory = (index: number, field: keyof SubCategory, value: any) => {
    const newSubs = [...(formData.subcategories || [])];
    newSubs[index] = { ...newSubs[index], [field]: value };
    setFormData({ ...formData, subcategories: newSubs });
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      setFormData((prev) => {
        const oldIndex = prev.subcategories!.findIndex((sub) => sub.id === active.id);
        const newIndex = prev.subcategories!.findIndex((sub) => sub.id === over!.id);
        
        return {
          ...prev,
          subcategories: arrayMove(prev.subcategories!, oldIndex, newIndex),
        };
      });
    }
  };


  if (loading) {
    return <TablePageSkeleton />;
  }

  const columns: ColumnDef<Category>[] = [
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => <span className="font-medium text-base">{row.original.category}</span>
    },
    {
      accessorKey: "subcategories",
      header: "Subcategories",
      cell: ({ row }) => (
         <span className="text-muted-foreground font-medium ml-4">{row.original.subcategories?.length || 0}</span>
      )
    },
    {
      accessorKey: "isOnWebsite",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
           <Switch
              checked={row.original.isOnWebsite}
              onCheckedChange={(checked) => handleStatusToggle(row.original, checked)}
           />
        </div>
      )
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
              onClick={(e) => openEditSheet(item, e)}
              className="h-8 w-8 p-0"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => handleDelete(item._id, e)}
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

  const handleUpdateSubcategoryImage = async (category: Category, subIndex: number, url: string) => {
    if (!category) return;
    const newSubcategories = [...category.subcategories];
    newSubcategories[subIndex] = { ...newSubcategories[subIndex], icon: url };
    const updatedCategory = { ...category, subcategories: newSubcategories };
    
    setData(prev => prev.map(c => c._id === category._id ? updatedCategory : c));
    setViewingItem(updatedCategory);

    try {
      await fetch(`/api/admin/categories/${category._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedCategory),
      });
      toast.success("Image updated");
    } catch (error) {
        toast.error("Failed to update image");
        fetchItems(); 
    }
  };

  const handleUpdateSubcategoryName = async (category: Category, subIndex: number, name: string) => {
     if (!category) return;
    const newSubcategories = [...category.subcategories];
    newSubcategories[subIndex] = { ...newSubcategories[subIndex], subcategory: name };
    const updatedCategory = { ...category, subcategories: newSubcategories };
    
    setData(prev => prev.map(c => c._id === category._id ? updatedCategory : c));
    setViewingItem(updatedCategory);

    try {
      await fetch(`/api/admin/categories/${category._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedCategory),
      });
    } catch (error) {
        toast.error("Failed to update name");
        fetchItems(); 
    }
  };

  const handleAddSubcategoryFromView = async () => {
     if (!viewingItem) return;
     const newSub = { 
        id: crypto.randomUUID(),
        subcategory: "New Subcategory", 
        isOnWebsite: false, 
        icon: "" 
     };
     const updatedCategory = { 
        ...viewingItem, 
        subcategories: [...(viewingItem.subcategories || []), newSub] 
     };

     setData(prev => prev.map(c => c._id === viewingItem._id ? updatedCategory : c));
     setViewingItem(updatedCategory);

     try {
       await fetch(`/api/admin/categories/${viewingItem._id}`, {
           method: "PUT",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify(updatedCategory),
       });
       toast.success("Subcategory added");
     } catch (error) {
         toast.error("Failed to add subcategory");
         fetchItems();
     }
  };


  return (
    <div className="w-full h-full overflow-hidden">
      <SimpleDataTable
        columns={columns}
        data={data}
        searchKey="category"
        onAdd={openAddSheet}
        onRowClick={(item) => setViewingItem(item)}
        title="Categories"
      />

      {/* Add/Edit Dialog */}
      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden gap-6">
            
            <div className="flex-1 flex flex-col min-h-0 space-y-6 pt-2">
                <div className="space-y-4 p-4 border rounded-xl bg-gray-50/50 shrink-0">
                   <div className="grid grid-cols-4 gap-6 items-end">
                      <div className="col-span-3 space-y-1.5">
                        <Label htmlFor="category" className="text-xs font-medium text-gray-500">Category Name</Label>
                        <Input
                          id="category"
                          placeholder="e.g., Fresh Fruits"
                          value={formData.category || ""}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          required
                          className="bg-white h-10"
                        />
                      </div>

                       <div className="col-span-1 space-y-1.5 flex flex-col items-center">
                            <Label htmlFor="isOnWebsite" className="text-xs font-medium text-gray-500">Show/Hide</Label>
                            <div className="flex items-center justify-center w-full h-10 rounded-md border bg-white">
                               <Switch
                                  id="isOnWebsite"
                                  checked={formData.isOnWebsite}
                                  onCheckedChange={(checked) => setFormData({ ...formData, isOnWebsite: checked })}
                                  className="scale-90"
                                />
                            </div>
                      </div>
                    </div>
                </div>

                {/* 2. Subcategories */}
                <div className="space-y-4 p-4 border rounded-xl bg-gray-50/50 flex flex-col flex-1 min-h-0">
                    <div className="flex-1 flex flex-col min-h-0">
                      {/* List Header */}
                      <div className="grid grid-cols-12 gap-4 px-2 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b mb-2 flex-shrink-0">
                          <div className="col-span-6 pl-10">Subcategory</div>
                          <div className="col-span-3 text-center">Image</div>
                          <div className="col-span-3 text-center">Actions</div>
                      </div>

                      <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                          <DndContext 
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                          >
                            <SortableContext 
                              items={formData.subcategories?.map(sub => sub.id) || []}
                              strategy={verticalListSortingStrategy}
                            >
                              {formData.subcategories?.map((sub, index) => (
                                <SortableSubcategoryRow
                                  key={sub.id}
                                  sub={sub}
                                  index={index}
                                  updateSubcategory={updateSubcategory}
                                  removeSubcategory={removeSubcategory}
                                />
                              ))}
                            </SortableContext>
                          </DndContext>
                          
                          {(!formData.subcategories || formData.subcategories.length === 0) && (
                            <div className="py-8 flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-xl bg-white/50 gap-2">
                              <p className="text-sm">No subcategories added yet.</p>
                              <Button type="button" variant="link" onClick={addSubcategory} className="text-primary h-auto p-0 text-sm">
                                Add your first subcategory
                              </Button>
                            </div>
                          )}
                      </div>
                    </div>
                </div>
            </div>

            <DialogFooter className="grid grid-cols-3 gap-3 border-t pt-4 mt-auto shrink-0">
               <Button variant="outline" type="button" onClick={() => setIsSheetOpen(false)} className="h-10">
                Cancel
              </Button>
              <Button type="button" variant="secondary" onClick={addSubcategory} className="h-10 border shadow-sm bg-white hover:bg-gray-100">
                 <Plus className="h-4 w-4 mr-2" /> Add Subcategory
              </Button>
              <Button type="submit" className="h-10 shadow-md">
                  {editingItem ? "Save Changes" : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* View Details Sheet */}
      <Sheet open={!!viewingItem} onOpenChange={(open) => !open && setViewingItem(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-2xl w-full p-6">
          <SheetHeader className="pb-6">
            <SheetTitle className="text-2xl font-bold">{viewingItem?.category}</SheetTitle>
            <SheetDescription>
              {viewingItem?.subcategories?.length || 0} Subcategories Available
            </SheetDescription>
          </SheetHeader>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4 pb-8">
             {viewingItem?.subcategories?.map((sub, index) => (
                <div key={index} className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md">
                  <div className="relative aspect-[16/9] w-full bg-muted overflow-hidden">
                     {/* Image Editing Enabled */}
                     <div className="w-full h-full relative">
                        <ImageUpload 
                          value={sub.icon || ""}
                          onChange={(url) => viewingItem && handleUpdateSubcategoryImage(viewingItem, index, url as string)}
                          compact
                        />
                     </div>
                     <div className="absolute left-2 top-2 pointer-events-none">
                        <Badge variant={sub.isOnWebsite ? "default" : "secondary"}>
                          {sub.isOnWebsite ? "Active" : "Inactive"}
                        </Badge>
                     </div>
                  </div>
                  <div className="flex flex-col p-4 gap-3">
                     {/* Name Editing Enabled */}
                     <Input 
                        defaultValue={sub.subcategory}
                        onBlur={(e) => viewingItem && handleUpdateSubcategoryName(viewingItem, index, e.target.value)}
                        className="text-lg font-semibold tracking-tight border-transparent hover:border-input focus:border-input px-0 h-auto py-1"
                     />

                     <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {sub.isOnWebsite ? "On Website" : "Hidden"}
                        </span>
                        <Switch
                            checked={sub.isOnWebsite}
                            onCheckedChange={(checked) => viewingItem && handleSubcategoryToggle(viewingItem, index, checked)}
                        />
                     </div>
                  </div>
                </div>
             ))}
             
             {/* Add New Card */}
             <div 
               onClick={handleAddSubcategoryFromView}
               className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors aspect-[3/4] sm:aspect-auto sm:h-full min-h-[200px]"
             >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 text-primary">
                    <Plus className="h-6 w-6" />
                </div>
                <h3 className="font-semibold">Add Subcategory</h3>
                <p className="text-sm text-muted-foreground mt-1">Create a new item</p>
             </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
