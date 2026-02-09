"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { 
  Pencil, 
  Upload,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const DEFAULT_DARK_IMAGE = "/images/dark-default.png";
const DEFAULT_LIGHT_IMAGE = "/images/light-default.png";

const initialSchedulingCards = [
  { name: "Schedule", bgDark: DEFAULT_DARK_IMAGE, bgLight: DEFAULT_LIGHT_IMAGE, route: "#" },
  { name: "Confirm Schedules", bgDark: DEFAULT_DARK_IMAGE, bgLight: DEFAULT_LIGHT_IMAGE, route: "#" },
  { name: "Work Hour Compliance", bgDark: DEFAULT_DARK_IMAGE, bgLight: DEFAULT_LIGHT_IMAGE, route: "#" },
  { name: "Capacity Planning", bgDark: DEFAULT_DARK_IMAGE, bgLight: DEFAULT_LIGHT_IMAGE, route: "#" },
  { name: "Availability", bgDark: DEFAULT_DARK_IMAGE, bgLight: DEFAULT_LIGHT_IMAGE, route: "#" },
  { name: "Schedule Check", bgDark: DEFAULT_DARK_IMAGE, bgLight: DEFAULT_LIGHT_IMAGE, route: "#" },
];

export default function SchedulingPage() {
  const router = useRouter();
  const [cards, setCards] = useState(initialSchedulingCards);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  useEffect(() => {
    fetch("/api/card-config?page=scheduling")
      .then(res => res.json())
      .then(data => {
        if (data.cards?.length) {
          setCards(prev => prev.map((card, i) => {
            const saved = data.cards.find((c: any) => c.index === i);
            if (!saved) return card;
            return {
              ...card,
              name: saved.name || card.name,
              bgDark: saved.bgDark || card.bgDark,
              bgLight: saved.bgLight || card.bgLight,
            };
          }));
        }
      })
      .catch(() => {});

    fetch("/api/user/permissions")
      .then(res => res.json())
      .then(data => {
        if (data.role === "Super Admin") {
          setIsSuperAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  // Edit State
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newDarkImage, setNewDarkImage] = useState<string | null>(null);
  const [newLightImage, setNewLightImage] = useState<string | null>(null);
  const [darkPreview, setDarkPreview] = useState<string | null>(null);
  const [lightPreview, setLightPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const darkFileRef = useRef<HTMLInputElement>(null);
  const lightFileRef = useRef<HTMLInputElement>(null);

  const startEdit = (index: number) => {
    setEditIndex(index);
    setNewName(cards[index].name);
    setNewDarkImage(null);
    setNewLightImage(null);
    setDarkPreview(cards[index].bgDark);
    setLightPreview(cards[index].bgLight);
  };

  const uploadToCloudinary = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      return data.secure_url || data.url || null;
    } catch {
      return null;
    }
  };

  const handleDarkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewDarkImage(file as any);
    const reader = new FileReader();
    reader.onload = (ev) => setDarkPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleLightFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewLightImage(file as any);
    const reader = new FileReader();
    reader.onload = (ev) => setLightPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const saveCard = async () => {
    if (editIndex === null) return;
    setIsSaving(true);

    try {
      let darkUrl = cards[editIndex].bgDark;
      let lightUrl = cards[editIndex].bgLight;

      if (newDarkImage) {
        const uploaded = await uploadToCloudinary(newDarkImage as any);
        if (uploaded) darkUrl = uploaded;
        else { toast.error("Failed to upload dark mode image"); setIsSaving(false); return; }
      }
      if (newLightImage) {
        const uploaded = await uploadToCloudinary(newLightImage as any);
        if (uploaded) lightUrl = uploaded;
        else { toast.error("Failed to upload light mode image"); setIsSaving(false); return; }
      }

      const updatedCards = [...cards];
      updatedCards[editIndex] = { ...updatedCards[editIndex], name: newName, bgDark: darkUrl, bgLight: lightUrl };
      setCards(updatedCards);

      const cardData = updatedCards.map((c, i) => ({
        index: i,
        name: c.name,
        bgDark: c.bgDark === DEFAULT_DARK_IMAGE ? undefined : c.bgDark,
        bgLight: c.bgLight === DEFAULT_LIGHT_IMAGE ? undefined : c.bgLight,
      }));

      const res = await fetch("/api/card-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: "scheduling", cards: cardData }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
        setIsSaving(false);
        return;
      }

      setEditIndex(null);
      toast.success("Card updated successfully");
    } catch {
      toast.error("Failed to save card settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {/* Hidden File Inputs */}
      <input type="file" ref={darkFileRef} className="hidden" accept="image/*" onChange={handleDarkFileSelect} />
      <input type="file" ref={lightFileRef} className="hidden" accept="image/*" onChange={handleLightFileSelect} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {cards.map((card, index) => (
          <div 
            key={index}
            className={cn(
              "group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-lg h-[200px]",
              card.route && card.route !== "#" && "cursor-pointer"
            )}
            onClick={() => card.route && card.route !== "#" && router.push(card.route)}
          >
            {/* Background Image with Overlay */}
            <div className="absolute inset-0 z-0">
               <Image 
                 src={card.bgDark} 
                 alt={card.name} 
                 fill 
                 className="object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 dark:opacity-60 hidden dark:block"
               />
               <Image 
                 src={card.bgLight} 
                 alt={card.name} 
                 fill 
                 className="object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 dark:opacity-60 block dark:hidden"
               />
               
               <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/40 to-transparent dark:from-black/90 dark:via-black/40 dark:to-transparent" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col justify-between h-full p-5">
                            {/* Top Actions */}
               <div className="flex items-start justify-end">
                  {/* Edit Button (Super Admin only) */}
                  {isSuperAdmin && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                     <Button 
                         size="icon" 
                         variant="secondary" 
                         className="h-8 w-8 rounded-full bg-background/40 hover:bg-background/60 backdrop-blur-sm border-0 text-foreground" 
                         title="Edit Card"
                         onClick={(e) => { e.stopPropagation(); startEdit(index); }}
                     >
                        <Pencil className="h-3.5 w-3.5" />
                     </Button>
                  </div>
                  )}
               </div>

               {/* Bottom Info — Glass Effect */}
               <div className="bg-white/15 dark:bg-black/20 backdrop-blur-md rounded-lg px-4 py-3 border border-white/25 dark:border-white/10 shadow-sm">
                  <h3 style={{ fontFamily: "'Lovelo', sans-serif" }} className="text-2xl uppercase tracking-wide drop-shadow-md text-zinc-900 dark:text-white group-hover:text-primary transition-colors duration-300">
                     {card.name}
                  </h3>
               </div>
               {(!card.route || card.route === "#") && (
                  <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/30 backdrop-blur-md hover:bg-primary/25 mt-2">
                     Coming Soon
                  </Badge>
               )}
            </div>
            
            <div className="absolute inset-0 border-2 border-transparent group-hover:border-primary/50 rounded-xl transition-colors duration-300 pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Edit Card Dialog */}
      <Dialog open={editIndex !== null} onOpenChange={(open) => !open && setEditIndex(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="card-name">Display Name</Label>
              <Input
                id="card-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Dark Mode Image</Label>
              <div
                className="relative flex items-center justify-center h-28 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden bg-zinc-900"
                onClick={() => darkFileRef.current?.click()}
              >
                {darkPreview ? (
                  <Image src={darkPreview} alt="Dark preview" fill className="object-cover opacity-70" />
                ) : null}
                <div className="relative z-10 flex flex-col items-center gap-1 text-muted-foreground">
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">Click to upload dark mode image</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Light Mode Image</Label>
              <div
                className="relative flex items-center justify-center h-28 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden bg-zinc-100"
                onClick={() => lightFileRef.current?.click()}
              >
                {lightPreview ? (
                  <Image src={lightPreview} alt="Light preview" fill className="object-cover opacity-70" />
                ) : null}
                <div className="relative z-10 flex flex-col items-center gap-1 text-muted-foreground">
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">Click to upload light mode image</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditIndex(null)} disabled={isSaving}>Cancel</Button>
            <Button onClick={saveCard} disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
