import React, { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { uploadMedia } from "@/services/mediaService";
import { useAuth } from "@/hooks/useAuth";
import type { FieldDefinition } from "@/types/modules";

interface Props {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function FileFieldEditor({ field, value, onChange, error }: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const media = await uploadMedia(file, "media", user?.id);
      onChange(media.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {value ? (
        <div className="flex items-center gap-2 p-2 border border-slate-200 rounded bg-slate-50">
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate flex-1">
            {value.split("/").pop()}
          </a>
          <button type="button" onClick={() => onChange("")} className="p-1 text-slate-400 hover:text-red-500">
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-slate-200 rounded hover:border-slate-300 hover:bg-slate-50 text-sm text-slate-500 disabled:opacity-50"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? "Uploading..." : "Choose File"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {(error || uploadError) && <p className="text-xs text-red-500 mt-1">{error || uploadError}</p>}
    </div>
  );
}
