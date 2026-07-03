import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Copy, Loader2, Image, Search } from "lucide-react";
import { getMediaItems, uploadMedia, deleteMedia, updateMediaAlt, type MediaItem } from "@/services/mediaService";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/utils";

export function MediaLibraryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState("");
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [altText, setAltText] = useState("");

  const load = async () => {
    setLoading(true);
    try { setItems(await getMediaItems(folder || undefined)); }
    catch (err) { toast.error(String(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [folder]);

  const filtered = items.filter((i) =>
    !search || i.originalName.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpload = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      try { await uploadMedia(file, folder || "general", user?.id); }
      catch { errors.push(file.name); }
    }
    if (errors.length) toast.error(`Failed: ${errors.join(", ")}`);
    else toast.success("Uploaded successfully.");
    load();
    setUploading(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMedia(deleteTarget.id);
      toast.success("Deleted.");
      setDeleteTarget(null);
      if (selected?.id === deleteTarget.id) setSelected(null);
      load();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveAlt = async () => {
    if (!selected) return;
    try {
      await updateMediaAlt(selected.id, altText);
      toast.success("Alt text saved.");
      setItems(items.map((i) => i.id === selected.id ? { ...i, altText } : i));
      setSelected({ ...selected, altText });
    } catch (err) {
      toast.error("Save failed: " + String(err));
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied!");
  };

  const folders = ["general", "images", "blog", "authors"];
  const isImage = (mime: string) => mime.startsWith("image/");

  return (
    <div className="flex h-full gap-6">
      {/* Main */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Media Library</h1>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Upload
            <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files)} />
          </label>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files…"
              className="w-full rounded border border-slate-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-1">
            {["", ...folders].map((f) => (
              <button key={f || "all"} onClick={() => setFolder(f)}
                className={`rounded px-3 py-2 text-xs font-medium transition-colors ${folder === f ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {f || "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Drag zone */}
        <div
          className="flex min-h-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
          onClick={() => document.getElementById("media-upload-input")?.click()}
        >
          Drop files here or click to upload
          <input id="media-upload-input" type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files)} />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {filtered.map((item) => (
              <button key={item.id} type="button" onClick={() => { setSelected(item); setAltText(item.altText ?? ""); }}
                className={`group overflow-hidden rounded-lg border bg-white text-left transition-shadow hover:shadow-md ${selected?.id === item.id ? "border-blue-400 ring-2 ring-blue-200" : "border-slate-200"}`}>
                {isImage(item.mimeType) ? (
                  <img src={item.url} alt={item.altText ?? item.originalName} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-slate-100">
                    <Image size={24} className="text-slate-400" />
                  </div>
                )}
                <p className="truncate px-1.5 py-1 text-xs text-slate-500">{item.originalName}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-64 shrink-0 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="aspect-square overflow-hidden rounded bg-slate-100">
            {isImage(selected.mimeType) ? (
              <img src={selected.url} alt={selected.altText ?? selected.originalName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center"><Image size={40} className="text-slate-300" /></div>
            )}
          </div>
          <div className="space-y-1 text-xs text-slate-500">
            <p className="font-medium text-slate-800 break-all">{selected.originalName}</p>
            <p>{(selected.size / 1024).toFixed(1)} KB</p>
            {selected.width && <p>{selected.width} × {selected.height}px</p>}
            <p>{formatDate(selected.createdAt)}</p>
          </div>
          <div>
            <label className="form-label text-xs">Alt Text</label>
            <input value={altText} onChange={(e) => setAltText(e.target.value)} className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <button onClick={handleSaveAlt} className="mt-1 w-full rounded border border-slate-200 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Save alt text</button>
          </div>
          <button onClick={() => copyUrl(selected.url)}
            className="flex w-full items-center justify-center gap-2 rounded border border-slate-200 py-2 text-xs text-slate-700 hover:bg-slate-50">
            <Copy size={12} /> Copy URL
          </button>
          <button onClick={() => setDeleteTarget(selected)}
            className="flex w-full items-center justify-center gap-2 rounded bg-red-50 py-2 text-xs font-medium text-red-600 hover:bg-red-100">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Media" description={`Delete "${deleteTarget?.originalName}"? This cannot be undone.`}
        confirmLabel="Delete" onConfirm={handleDelete} isLoading={deleting} />
    </div>
  );
}
