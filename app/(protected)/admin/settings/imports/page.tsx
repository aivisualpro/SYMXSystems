"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import Papa from "papaparse";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function ImportsSettingsPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a valid CSV file");
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setStatusMessage("Reading file...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data;
        const totalRows = data.length;
        const batchSize = 50;
        let processedCount = 0;
        let totalInserted = 0;
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

            // Artificial delay for visual smoothness if batch is super fast (optional, but good for UX)
            // await new Promise(r => setTimeout(r, 100));

            const response = await fetch("/api/admin/imports", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                type: "employees",
                data: batch,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Batch ${successfulBatches + 1} failed`);
            }

            const result = await response.json();
            totalInserted += result.count || 0; 
            // result.count is generic, might be undefined in my API response logic if not set correctly, 
            // but my API returns `{ count: ... }` so it is fine.
            
            processedCount += batch.length;
            successfulBatches++;
          }

          setProgress(100);
          setStatusMessage("Import complete!");
          toast.success(`Successfully processed ${totalRows} records. Updated/Inserted: ${totalInserted}`);
          
          // Small delay before closing dialog
          setTimeout(() => {
            setIsUploading(false);
            setProgress(0);
            setStatusMessage("");
          }, 1500);

        } catch (error: any) {
          console.error("Import error:", error);
          toast.error(error.message || "Failed to import data");
          setIsUploading(false);
        } finally {
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
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
        <Button
          variant="outline"
          className={cn(
            "flex h-32 flex-col items-center justify-center gap-4 transition-all hover:bg-accent hover:text-accent-foreground border-dashed border-2",
            isUploading && "opacity-50 pointer-events-none"
          )}
          onClick={handleImportClick}
          disabled={isUploading}
        >
          <div className="p-3 rounded-full bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
             <span className="font-semibold text-lg">Import Employees CSV</span>
             <p className="text-xs text-muted-foreground mt-1">Click to upload .csv file</p>
          </div>
        </Button>
      </div>

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
