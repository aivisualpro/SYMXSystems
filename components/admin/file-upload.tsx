
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileText, X, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

interface FileUploadProps {
  value: string | string[];
  onChange: (url: string | string[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  accept?: string;
  label?: string;
}

export function FileUpload({
  value,
  onChange,
  disabled,
  multiple = false,
  accept = "*",
  label = "Upload File"
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

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Upload failed");
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
      <div className="flex flex-wrap gap-4">
        {urls.length > 0 && urls.map((url, index) => (
            <div key={index} className="relative flex items-center p-2 border rounded-md bg-muted/20 w-full max-w-sm">
              <FileText className="h-4 w-4 mr-2 text-primary" />
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm truncate flex-1 hover:underline text-blue-600"
              >
                {url.split('/').pop()}
              </a>
              <Button
                type="button"
                onClick={() => handleRemove(url)}
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-2 text-destructive hover:bg-destructive/10"
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        }
      </div>
      <div>
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
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto"
          >
            {loading ? (
               <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {label}
          </Button>
      </div>
    </div>
  );
}
