"use client";

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import 'quill/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  // Dynamically import ReactQuill to avoid SSR issues
  const ReactQuill = useMemo(
    () => dynamic(() => import('react-quill-new'), { ssr: false }),
    []
  );

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ color: [] }, { background: [] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['link', 'clean'],
    ],
  };

  return (
    <div className={`rich-text-editor ${className}`}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        placeholder={placeholder}
        className="bg-background text-foreground"
      />
      <style jsx global>{`
        .ql-toolbar.ql-snow {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          border-color: hsl(var(--input));
          background: hsl(var(--muted)/0.3);
        }
        .ql-container.ql-snow {
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
          border-color: hsl(var(--input));
          min-height: 200px;
          font-size: 1rem;
        }
        .ql-editor {
          min-height: 200px;
        }
        /* Fix toolbar icons in dark mode */
        .dark .ql-stroke {
          stroke: hsl(var(--foreground)) !important;
        }
        .dark .ql-fill {
          fill: hsl(var(--foreground)) !important;
        }
        .dark .ql-picker {
          color: hsl(var(--foreground)) !important;
        }
      `}</style>
    </div>
  );
}
