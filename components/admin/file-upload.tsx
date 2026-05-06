
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileText, X, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  value: string | string[];
  onChange: (url: string | string[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  accept?: string;
  label?: string;
  compact?: boolean;
}

export function FileUpload({
  value,
  onChange,
  disabled,
  multiple = false,
  accept = "*",
  label = "Upload File",
  compact = false
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  // Normalize value to array
  const urls = Array.isArray(value) ? value : value ? [value] : [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    const uploadedUrls: string[] = [];
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB Limit

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.size > MAX_SIZE) {
            toast.error(`File ${file.name} is too large (max 10MB).`);
            continue;
        }

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });

        // Safely parse — server may return HTML/text on size or auth errors
        let data: any = {};
        try {
          data = await res.json();
        } catch {
          const text = await res.text().catch(() => "");
          if (text.toLowerCase().includes("too large") || text.toLowerCase().includes("entity")) {
            throw new Error(`File "${file.name}" is too large for the server. Please reduce the file size and try again.`);
          }
          throw new Error(`Upload failed: unexpected server response. Please try again.`);
        }

        if (!res.ok) {
          throw new Error(data?.error || `Upload failed (${res.status})`);
        }

        uploadedUrls.push(data.secure_url);
      }

      if (uploadedUrls.length > 0) {
        if (multiple) {
            onChange([...urls, ...uploadedUrls]);
        } else {
            onChange(uploadedUrls[0]);
        }
        toast.success("File uploaded successfully");
      }
      
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = (urlToRemove: string) => {
    if (multiple) {
      onChange(urls.filter((url) => url !== urlToRemove));
    } else {
      onChange("");
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className={cn("flex flex-wrap gap-4", compact ? "gap-1" : "")}>
        {urls.length > 0 && urls.map((url, index) => (
            <div key={index} className={cn("relative flex items-center p-2 border rounded-md bg-muted/20 w-full max-w-sm", compact ? "px-1 w-auto max-w-[150px] bg-transparent border-0" : "")}>
              <FileText className={cn("text-primary", compact ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2")} />
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className={cn("text-sm truncate flex-1 hover:underline text-blue-600", compact ? "text-xs" : "")}
                title={url.split('/').pop()}
              >
                {compact ? "View" : url.split('/').pop()}
              </a>
              <Button
                type="button"
                onClick={() => handleRemove(url)}
                variant="ghost"
                size="icon"
                className={cn("text-destructive hover:bg-destructive/10", compact ? "h-4 w-4 ml-1" : "h-6 w-6 ml-2")}
                disabled={disabled}
              >
                <X className={cn("h-4 w-4", compact ? "h-3 w-3" : "")} />
              </Button>
            </div>
          ))
        }
      </div>
      {(!compact || urls.length === 0 || multiple) && (
        <div className={compact ? "mt-0 flex" : ""}>
          <input
            type="file"
            disabled={loading || disabled}
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
            accept={accept}
            multiple={multiple}
          />
          <Button
              type="button"
              disabled={loading || disabled}
              variant={compact ? "ghost" : "outline"}
              size={compact ? "sm" : "default"}
              onClick={() => fileInputRef.current?.click()}
              className={cn("w-full sm:w-auto", compact ? "h-6 px-2 text-[10px]" : "")}
            >
              {loading ? (
                 <Loader2 className={cn("animate-spin", compact ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2")} />
              ) : (
                <Upload className={cn(compact ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2")} />
              )}
              {compact ? "Upload" : label}
            </Button>
        </div>
      )}
    </div>
  );
}
