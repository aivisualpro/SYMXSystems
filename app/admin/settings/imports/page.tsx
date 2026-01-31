
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Upload, Users, Truck, Package, ShoppingCart, FileText, MapPin } from "lucide-react";
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
  const [currentImportType, setCurrentImportType] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = (type: string) => {
    setCurrentImportType(type);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentImportType) return;

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
        const batchSize = 100;
        let processedCount = 0;
        let totalInserted = 0;

        try {
          for (let i = 0; i < totalRows; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const currentProgress = Math.round((i / totalRows) * 100);
            
            setProgress(currentProgress);
            setStatusMessage(`Importing ${processedCount} of ${totalRows} records...`);

            const response = await fetch("/api/admin/imports", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                type: currentImportType,
                data: batch,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || "Import failed");
            }

            const result = await response.json();
            totalInserted += result.count || batch.length;
            processedCount += batch.length;
          }

          setProgress(100);
          setStatusMessage("Import complete!");
          toast.success(`Successfully imported ${totalInserted} ${currentImportType}(s)`);
        } catch (error: any) {
          console.error("Import error:", error);
          toast.error(error.message || "Failed to import data");
        } finally {
          setIsUploading(false);
          setProgress(0);
          setStatusMessage("");
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          setCurrentImportType(null);
        }
      },
      error: (error) => {
        console.error("PapaParse error:", error);
        toast.error("Failed to parse CSV file");
        setIsUploading(false);
      },
    });
  };

  const importOptions = [
    { name: "Customers", icon: Users, type: "customers" },
    { name: "Customer Locations", icon: MapPin, type: "customer-locations" },
    { name: "Suppliers", icon: Truck, type: "suppliers" },
    { name: "Supplier Locations", icon: MapPin, type: "supplier-locations" },
    { name: "Products", icon: Package, type: "products" },
    { name: "Purchase Orders (VB PO)", icon: ShoppingCart, type: "purchase-orders" },
    { name: "Shippings", icon: Truck, type: "shippings" },
    { name: "Customer POs", icon: FileText, type: "customer-pos" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Imports</h3>
        <p className="text-sm text-muted-foreground">
          Import data into the system using CSV files.
        </p>
      </div>
      <Separator />
      
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".csv"
        onChange={handleFileChange}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {importOptions.map((option) => (
          <Button
            key={option.name}
            variant="outline"
            className={cn(
              "flex h-24 flex-col items-center justify-center gap-2 transition-all hover:bg-accent hover:text-accent-foreground",
              isUploading && "opacity-50 pointer-events-none"
            )}
            onClick={() => handleImportClick(option.type)}
            disabled={isUploading}
          >
            <option.icon className="h-6 w-6" />
            <span>Import {option.name}</span>
          </Button>
        ))}
      </div>

      <Dialog open={isUploading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importing Data</DialogTitle>
            <DialogDescription>
              Please wait while your data is being processed. This may take a moment depending on the file size.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between text-sm font-medium">
              <span>{statusMessage}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
