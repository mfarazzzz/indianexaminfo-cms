import { supabase, db } from "@/lib/supabase/client";
import { validateImageFile } from "@/lib/utils";

export type MediaItem = {
  id: string; filename: string; originalName: string; url: string;
  thumbnailUrl: string | null; mimeType: string; size: number;
  width: number | null; height: number | null; altText: string | null;
  folder: string; uploadedBy: string | null; createdAt: string;
};

/** Allowed storage folders — prevents path traversal */
const ALLOWED_FOLDERS = new Set(["general", "images", "blog", "authors", "media"]);

function sanitizeFolder(folder: string): string {
  const clean = folder.replace(/[^a-z0-9-_]/gi, "");
  return ALLOWED_FOLDERS.has(clean) ? clean : "general";
}

function mapRow(row: any): MediaItem {
  return {
    id: row.id, filename: row.filename, originalName: row.original_name,
    url: row.url, thumbnailUrl: row.thumbnail_url, mimeType: row.mime_type,
    size: row.size, width: row.width, height: row.height, altText: row.alt_text,
    folder: row.folder ?? "general", uploadedBy: row.uploaded_by, createdAt: row.created_at,
  };
}

export async function getMediaItems(folder?: string): Promise<MediaItem[]> {
  let q = db.from("media").select("*").order("created_at", { ascending: false });
  if (folder) q = q.eq("folder", sanitizeFolder(folder));
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function uploadMedia(file: File, folder = "general", userId?: string): Promise<MediaItem> {
  // Validate file type and size
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);

  const safeFolder = sanitizeFolder(folder);

  // Generate a safe, unpredictable filename — strip original name to prevent path injection
  const ext = (file.name.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 5);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const storagePath = `${safeFolder}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(storagePath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(storagePath);

  const { data, error } = await db.from("media").insert({
    filename,
    original_name: file.name.slice(0, 255), // cap length
    url: publicUrl,
    mime_type: file.type,
    size: file.size,
    folder: safeFolder,
    uploaded_by: userId ?? null,
  }).select().single();
  if (error) throw error;
  return mapRow(data);
}

export async function deleteMedia(id: string): Promise<void> {
  // A failed lookup must NOT skip the storage removal and then report success —
  // and a failed DB delete must not leave the row listed while the file is gone.
  const { data, error: fetchErr } = await db.from("media").select("filename, folder").eq("id", id).single();
  if (fetchErr) {
    console.error(`[mediaService] deleteMedia(${id}) row lookup failed:`, fetchErr);
    throw new Error(`Could not read this media item — delete aborted (${fetchErr.message}).`);
  }
  if (data) {
    const safeFolder = sanitizeFolder(data.folder as string);
    const safeFilename = (data.filename as string).replace(/[^a-z0-9._-]/gi, "");
    const { error: rmErr } = await supabase.storage.from("media").remove([`${safeFolder}/${safeFilename}`]);
    if (rmErr) console.error(`[mediaService] deleteMedia(${id}) storage file removal failed (row delete proceeds):`, rmErr);
  }
  const { error: delErr } = await db.from("media").delete().eq("id", id);
  if (delErr) {
    console.error(`[mediaService] deleteMedia(${id}) row delete failed:`, delErr);
    throw new Error(`Media row could not be deleted — ${delErr.message}`);
  }
}

export async function updateMediaAlt(id: string, altText: string): Promise<void> {
  // Cap alt text length
  const { error } = await db.from("media").update({ alt_text: altText.slice(0, 500) }).eq("id", id);
  if (error) {
    console.error(`[mediaService] updateMediaAlt(${id}) failed:`, error);
    throw new Error(`Alt text could not be saved — ${error.message}`);
  }
}
