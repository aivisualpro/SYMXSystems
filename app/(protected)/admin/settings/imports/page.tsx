"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Users, Activity, Camera, Check, Search, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import Papa from "papaparse";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ImportsSettingsPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [importType, setImportType] = useState<string>("employees");
  const [showWeekSelector, setShowWeekSelector] = useState(false);
  
  // Week Selection State
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [weekSearchTerm, setWeekSearchTerm] = useState("");
  const [filteredWeeks, setFilteredWeeks] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate weeks for the dropdown (2025-2027)
  const generateWeeks = () => {
     const years = [2025, 2026, 2027];
     const allWeeks = [];
     for (const year of years) {
         for (let i = 1; i <= 53; i++) {
             allWeeks.push(`${year}-W${i.toString().padStart(2, '0')}`);
         }
     }
     return allWeeks;
  };

  const allWeeks = generateWeeks();

  // Initialize Default Week
  useEffect(() => {
     try {
       const currentForDefault = format(new Date(), "RRRR-'W'II");
       if (!selectedWeek) {
           setSelectedWeek(currentForDefault);
           setWeekSearchTerm(currentForDefault);
       }
     } catch (e) {
       console.error("Error formatting date", e);
     }
  }, []);

  useEffect(() => {
      if (weekSearchTerm) {
          const lower = weekSearchTerm.toLowerCase();
          const filtered = allWeeks.filter(w => w.toLowerCase().includes(lower));
          setFilteredWeeks(filtered.slice(0, 10)); 
      } else {
          setFilteredWeeks(allWeeks.filter(w => w.startsWith('2026')).slice(0, 10)); 
      }
  }, [weekSearchTerm]);

  const handleImportClick = (type: string) => {
    setImportType(type);
    
    if (type === "import-pod" || type === "customer-delivery-feedback") {
        setShowWeekSelector(true);
        // Set default if not set
        if (!selectedWeek || !weekSearchTerm) {
             const current = format(new Date(), "RRRR-'W'II");
             setSelectedWeek(current);
             setWeekSearchTerm(current); 
        }
    } else {
        triggerFileInput();
    }
  };

  const confirmWeekSelection = () => {
      const finalWeek = weekSearchTerm.trim();
      const weekRegex = /^\d{4}-W\d{2}$/;
      
      if (!weekRegex.test(finalWeek)) {
          toast.error("Invalid week format. Use YYYY-Www (e.g. 2026-W05)");
          return;
      }
      
      setSelectedWeek(finalWeek);
      setShowWeekSelector(false);
      triggerFileInput();
  }

  const triggerFileInput = () => {
    if (fileInputRef.current) {
        fileInputRef.current.click();
      }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a valid CSV file");
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setStatusMessage(`Reading ${importType === 'employees' ? 'Employee' : 'Performance'} file...`);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data;
        const totalRows = data.length;
        const batchSize = 50;
        let processedCount = 0;
        let totalInserted = 0;
        let insertedCount = 0;
        let updatedCount = 0;
        let successfulBatches = 0;

        try {
          // Process in batches
          for (let i = 0; i < totalRows; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const remaining = totalRows - processedCount;
            
            // Calculate progress for animation
            const currentProgress = Math.min(Math.round((processedCount / totalRows) * 100), 99);
            setProgress(currentProgress);
            
            setStatusMessage(`Processing... ${remaining} records remaining`);

            const payload: any = {
                type: importType,
                data: batch,
            };

            // Add week if POD or CDF
            if (importType === 'import-pod' || importType === "customer-delivery-feedback") {
                payload.week = selectedWeek;
            }

            const response = await fetch("/api/admin/imports", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Batch ${successfulBatches + 1} failed`);
            }

            const result = await response.json();
            totalInserted += result.count || 0;
            // Track granular stats if available
            insertedCount += result.inserted || 0;
            updatedCount += result.updated || 0;
            
            processedCount += batch.length;
            successfulBatches++;
          }

          setProgress(100);
          setStatusMessage("Import complete!");
          toast.success(`Processed ${totalRows} records. Added: ${insertedCount}, Updated: ${updatedCount}`);
          
          // Small delay before closing dialog
          setTimeout(() => {
            setIsUploading(false);
            setProgress(0);
            setStatusMessage("");
            if (fileInputRef.current) fileInputRef.current.value = ""; // Reset input
          }, 1500);

        } catch (error: any) {
          console.error("Import error:", error);
          toast.error(error.message || "Failed to import data");
          setIsUploading(false);
        } finally {
           // Reset explicitly handled in timeout for success, but here for error safety
           if (fileInputRef.current) {
             // fileInputRef.current.value = ""; // Don't reset immediately on success to let animation finish but okay on error
           }
        }
      },
      error: (error) => {
        console.error("PapaParse error:", error);
        toast.error("Failed to parse CSV file");
        setIsUploading(false);
      },
    });
  };

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".csv"
        onChange={handleFileChange}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Employees Import */}
        <Button
          variant="outline"
          className={cn(
            "flex h-40 flex-col items-center justify-center gap-4 transition-all hover:bg-accent hover:text-accent-foreground border-dashed border-2",
            isUploading && "opacity-50 pointer-events-none"
          )}
          onClick={() => handleImportClick("employees")}
          disabled={isUploading}
        >
          <div className="p-3 rounded-full bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
             <span className="font-semibold text-lg">Employees</span>
             <p className="text-xs text-muted-foreground mt-1">Updates existing or creates new employees</p>
          </div>
        </Button>

        {/* Delivery Excellence Import */}
        <Button
          variant="outline"
          className={cn(
            "flex h-40 flex-col items-center justify-center gap-4 transition-all hover:bg-accent hover:text-accent-foreground border-dashed border-2",
            isUploading && "opacity-50 pointer-events-none"
          )}
          onClick={() => handleImportClick("delivery-excellence")}
          disabled={isUploading}
        >
          <div className="p-3 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20">
            <Activity className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-center">
             <span className="font-semibold text-lg">Delivery Excellence</span>
             <p className="text-xs text-muted-foreground mt-1">Import DSP metrics matched by Transporter ID</p>
          </div>
        </Button>

        {/* Photo On Delivery Import */}
        <Button
          variant="outline"
          className={cn(
            "flex h-40 flex-col items-center justify-center gap-4 transition-all hover:bg-accent hover:text-accent-foreground border-dashed border-2",
            isUploading && "opacity-50 pointer-events-none"
          )}
          onClick={() => handleImportClick("import-pod")}
          disabled={isUploading}
        >
          <div className="p-3 rounded-full bg-blue-500/10 dark:bg-blue-500/20">
            <Camera className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-center">
             <span className="font-semibold text-lg">Photo On Delivery</span>
             <p className="text-xs text-muted-foreground mt-1">Import POD metrics (Select Week first)</p>
          </div>
        </Button>

        {/* Customer Delivery Feedback Import */}
        <Button
          variant="outline"
          className={cn(
            "flex h-40 flex-col items-center justify-center gap-4 transition-all hover:bg-accent hover:text-accent-foreground border-dashed border-2",
            isUploading && "opacity-50 pointer-events-none"
          )}
          onClick={() => handleImportClick("customer-delivery-feedback")}
          disabled={isUploading}
        >
          <div className="p-3 rounded-full bg-violet-500/10 dark:bg-violet-500/20">
            <MessageSquare className="h-8 w-8 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-center">
             <span className="font-semibold text-lg">Delivery Feedback</span>
             <p className="text-xs text-muted-foreground mt-1">Import CDF metrics (Select Week first)</p>
          </div>
        </Button>
      </div>
      
      {/* Week Selection Dialog */}
      <Dialog open={showWeekSelector} onOpenChange={setShowWeekSelector}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Week</DialogTitle>
            <DialogDescription>
              Choose the week for the data you are importing.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
             <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                   type="text" 
                   placeholder="Search or enter week..."
                   className="pl-9"
                   value={weekSearchTerm}
                   onChange={(e) => setWeekSearchTerm(e.target.value)}
                />
             </div>
             
             {/* List */}
             <div className="max-h-[200px] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-sm">
                 {weekSearchTerm && !allWeeks.includes(weekSearchTerm) && /^\d{4}-W\d{2}$/.test(weekSearchTerm) && (
                     <div 
                         className="flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                         onClick={() => setWeekSearchTerm(weekSearchTerm)}
                     >
                         <Check className={cn("mr-2 h-4 w-4", weekSearchTerm === selectedWeek ? "opacity-100" : "opacity-0")} />
                         Create "{weekSearchTerm}"
                     </div>
                 )}

                {filteredWeeks.length > 0 ? (
                    filteredWeeks.map((week) => (
                        <div
                            key={week}
                            className={cn(
                                "flex cursor-pointer select-none items-center px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                                weekSearchTerm === week && "bg-accent/50"
                            )}
                            onClick={() => {
                                setWeekSearchTerm(week);
                                setSelectedWeek(week);
                            }}
                        >
                             <Check className={cn("mr-2 h-4 w-4", weekSearchTerm === week ? "opacity-100" : "opacity-0")} />
                             {week}
                        </div>
                    ))
                ) : (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                        {/^\d{4}-W\d{2}$/.test(weekSearchTerm) ? "Click Create above" : "No weeks found"}
                    </div>
                )}
             </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setShowWeekSelector(false)}>Cancel</Button>
             <Button onClick={confirmWeekSelection}>Continue to Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUploading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Importing Employees</DialogTitle>
            <DialogDescription>
              Please wait while we process your file. Do not close this window.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col gap-2">
                 <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2 w-full transition-all duration-500" />
            </div>
            
             <div className="flex items-center justify-center p-4 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium animate-pulse">
                    {statusMessage}
                </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
