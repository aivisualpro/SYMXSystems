"use client";

import { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Loader2, X, UploadCloud, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadItem {
  id: string;
  file?: File;
  name: string;
  url?: string;
  uploading: boolean;
  error?: string;
  category: string;
  previewUrl?: string;
}

interface AttachmentUploaderProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accept?: string;
  category: string;
  module?: string;
  items: UploadItem[];
  setItems: React.Dispatch<React.SetStateAction<UploadItem[]>>;
  hint?: string;
  // Fired once a file finishes uploading successfully. Lets the caller save
  // it immediately (e.g. push it onto an already-created record) instead of
  // requiring a separate "attach" step the user has to remember to click.
  onUploaded?: (item: UploadItem) => void;
}

// Drag-and-drop / click-to-browse multi-file uploader. Each selected file
// starts uploading immediately (rather than waiting for a form submit), and
// new selections are appended to the existing list — previously the plain
// <input type="file" multiple> in this form replaced the whole FileList on
// every reopen of the picker, so picking photos in more than one pass
// silently dropped everything chosen before. Uses functional setState
// updates throughout so concurrent uploads of several files never clobber
// each other's results.
export function AttachmentUploader({
  label,
  icon: Icon,
  accept,
  category,
  module = "Incidents",
  items,
  setItems,
  hint,
  onUploaded,
}: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadOne = async (item: UploadItem) => {
    try {
      const fd = new FormData();
      fd.append("file", item.file!);
      fd.append("module", module);
      const r = await fetch("/api/upload/cloudinary", { method: "POST", body: fd });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || "Upload failed");
      const uploaded = { ...item, uploading: false, url: json.url };
      setItems((prev) => prev.map((it) => (it.id === item.id ? uploaded : it)));
      onUploaded?.(uploaded);
    } catch (err: any) {
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, uploading: false, error: err.message || "Upload failed" } : it)));
    }
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const newItems: UploadItem[] = Array.from(fileList).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      name: file.name,
      uploading: true,
      category,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setItems((prev) => [...prev, ...newItems]);
    newItems.forEach((item) => uploadOne(item));
  };

  const retry = (item: UploadItem) => {
    if (!item.file) return;
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, uploading: true, error: undefined } : it)));
    uploadOne(item);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex items-center gap-1 text-xs">
        <Icon className="h-3.5 w-3.5" /> {label}
      </Label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed p-3 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:bg-muted/40"
        )}
      >
        <UploadCloud className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-primary">Click to upload</span> or drag and drop
          {items.length > 0 && ` — ${items.length} file${items.length === 1 ? "" : "s"} added`}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {items.map((item) => (
            <div key={item.id} className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted/30">
              {item.previewUrl ? (
                <img src={item.previewUrl} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              {item.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                </div>
              )}
              {item.error && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    retry(item);
                  }}
                  title={item.error}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-destructive/85 text-white"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-[9px] font-medium">Retry</span>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(item.id);
                }}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 text-[9px] text-white">{item.name}</span>
            </div>
          ))}
        </div>
      )}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function itemsUploading(items: UploadItem[]) {
  return items.some((it) => it.uploading);
}

export function itemsToAttachments(items: UploadItem[]) {
  return items.filter((it) => it.url).map((it) => ({ name: it.name, url: it.url!, category: it.category }));
}
