import React, { useRef, useState } from "react";
import { X, Image as ImageIcon, Loader2 } from "lucide-react";
import { uploadMedia } from "@/services/mediaService";
import { useAuth } from "@/hooks/useAuth";
import { cn, validateImageFile, isSafeUrl } from "@/lib/utils";

interface ImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
  className?: string;
  label?: string;
}

export function ImageUploader({
  value,
  onChange,
  folder = "images",
  className,
  label = "Upload Image",
}: ImageUploaderProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pastedUrl, setPastedUrl] = useState("");

  const handleFile = async (file: File) => {
    setError(null);

    // Validate before upload
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    try {
      const media = await uploadMedia(file, folder, user?.id);
      onChange(media.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handlePasteUrl = () => {
    const url = pastedUrl.trim();
    if (!url) return;
    if (!isSafeUrl(url)) {
      setError("Invalid URL. Only https:// URLs are allowed.");
      return;
    }
    onChange(url);
    setPastedUrl("");
    setError(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="Preview"
            className="max-h-40 rounded border border-slate-200 object-cover"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove image"
            className="absolute -right-2 -top-2 rounded-full bg-white p-0.5 shadow ring-1 ring-slate-200 hover:bg-red-50"
          >
            <X size={12} className="text-slate-500" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload image area — click or drag and drop"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 transition-colors",
            dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
          )}
        >
          {uploading
            ? <Loader2 className="animate-spin text-blue-500" size={24} aria-hidden="true" />
            : <ImageIcon className="text-slate-400" size={24} aria-hidden="true" />
          }
          <span className="text-xs text-slate-500">
            {uploading ? "Uploading…" : `${label} or drag & drop`}
          </span>
          <span className="text-xs text-slate-400">JPG, PNG, WebP, SVG up to 5 MB</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="sr-only"
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          // Reset so same file can be re-selected
          e.target.value = "";
        }}
      />

      {!value && (
        <div className="flex items-center gap-2">
          <label htmlFor="paste-url-input" className="text-xs text-slate-400 shrink-0">
            or paste URL:
          </label>
          <input
            id="paste-url-input"
            type="url"
            value={pastedUrl}
            onChange={(e) => setPastedUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handlePasteUrl(); } }}
            placeholder="https://…"
            className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {pastedUrl && (
            <button type="button" onClick={handlePasteUrl}
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">
              Use
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600" role="alert">{error}</p>
      )}
    </div>
  );
}
