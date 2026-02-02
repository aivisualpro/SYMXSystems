"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

interface ImageUploadProps {
  value: string | string[];
  onChange: (url: string | string[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  compact?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  disabled,
  multiple = false,
  compact = false
}: ImageUploadProps) {
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
        
        // Client-side validation
        if (file.size > MAX_SIZE) {
            toast.error(`File ${file.name} allows max 10MB. Got ${(file.size / 1024 / 1024).toFixed(2)}MB`);
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

      // Update state
      if (uploadedUrls.length > 0) {
        if (multiple) {
            onChange([...urls, ...uploadedUrls]);
        } else {
            onChange(uploadedUrls[0]);
        }
        toast.success("Image uploaded successfully");
      }
      
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setLoading(false);
      // Reset input
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
    <div className="space-y-4 w-full h-full">
      <div className="flex flex-wrap gap-4 w-full h-full">
        {urls.length > 0 ? (
          urls.map((url, index) => (
            <div key={index} className={`relative ${compact ? "w-full h-full" : "w-[200px] h-[200px]"} rounded-md overflow-hidden border`}>
              <div className="z-10 absolute top-1 right-1">
                <Button
                  type="button"
                  onClick={() => handleRemove(url)}
                  variant="destructive"
                  size="icon"
                  className={compact ? "h-5 w-5 opacity-70 hover:opacity-100" : ""}
                  disabled={disabled}
                >
                  <X className={compact ? "h-3 w-3" : "h-4 w-4"} />
                </Button>
              </div>
              <Image
                fill
                className="object-contain bg-white"
                alt="Image"
                src={url}
              />
            </div>
          ))
        ) : (
           /* Show upload button directly if compact and no image */
           compact && (
            <Button
              type="button"
              disabled={loading || disabled}
              variant="secondary"
              className="w-full h-full flex flex-col gap-1 items-center justify-center p-0 bg-transparent hover:bg-muted/50"
              onClick={() => fileInputRef.current?.click()}
            >
              {loading ? (
                 <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-5 w-5 text-muted-foreground/50" />
              )}
            </Button>
           )
        )}
      </div>
      <div>
        <input
          type="file"
          disabled={loading || disabled}
          ref={fileInputRef}
          onChange={handleUpload}
          className="hidden"
          accept="image/*"
          multiple={multiple}
        />
        {!compact && (
          <Button
            type="button"
            disabled={loading || disabled}
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            {loading ? (
               <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ImagePlus className="h-4 w-4 mr-2" />
            )}
            Upload Image
          </Button>
        )}
      </div>
    </div>
  );
}
