import React, { useEffect, useState } from "react";
import { cn, slugify } from "@/lib/utils";
import { Check, X, Loader2 } from "lucide-react";

interface SlugInputProps {
  value: string;
  onChange: (value: string) => void;
  sourceValue?: string;   // Auto-generate slug from this value
  checkAvailable?: (slug: string) => Promise<boolean>;
  previewPrefix?: string; // e.g. "https://indianexaminfo.com/sarkari-naukri/banking/"
  disabled?: boolean;
  className?: string;
}

export function SlugInput({
  value,
  onChange,
  sourceValue,
  checkAvailable,
  previewPrefix,
  disabled,
  className,
}: SlugInputProps) {
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [edited, setEdited] = useState(false);

  // Auto-generate from sourceValue if not manually edited
  useEffect(() => {
    if (sourceValue && !edited) {
      onChange(slugify(sourceValue));
    }
  }, [sourceValue, edited, onChange]);

  // Check availability with debounce
  useEffect(() => {
    if (!value || !checkAvailable) {
      setAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const ok = await checkAvailable(value);
        setAvailable(ok);
      } finally {
        setChecking(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [value, checkAvailable]);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setEdited(true);
            onChange(slugify(e.target.value) || e.target.value);
          }}
          disabled={disabled}
          placeholder="url-slug-here"
          className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500 pr-8"
        />
        <div className="absolute right-2 flex items-center">
          {checking && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          {!checking && available === true && <Check className="h-4 w-4 text-green-500" />}
          {!checking && available === false && <X className="h-4 w-4 text-red-500" />}
        </div>
      </div>

      {previewPrefix && value && (
        <p className="truncate text-xs text-slate-500">
          {previewPrefix}
          <span className="font-medium text-slate-700">{value}</span>
        </p>
      )}

      {available === false && (
        <p className="text-xs text-red-600">This slug is already taken.</p>
      )}
    </div>
  );
}
