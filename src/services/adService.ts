import { db } from "@/lib/supabase/client";
import type { AdZone, AdCampaign, AdCreative, AdReport, Advertiser } from "@/types/ad";

export async function getAdZones(): Promise<AdZone[]> {
  const { data, error } = await db.from("ad_zones").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, slug: r.slug, name: r.name, size: r.size, position: r.position,
    pagePlacement: r.page_placement, description: r.description,
    isActive: r.is_active, fallbackHtml: r.fallback_html, createdAt: r.created_at,
  }));
}

export async function updateAdZone(id: string, input: Partial<AdZone>): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.isActive !== undefined) updates.is_active = input.isActive;
  if (input.fallbackHtml !== undefined) updates.fallback_html = input.fallbackHtml;
  if (input.name !== undefined) updates.name = input.name;
  await db.from("ad_zones").update(updates).eq("id", id);
}

export async function getAdvertisers(): Promise<Advertiser[]> {
  const { data, error } = await db.from("advertisers").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, userId: r.user_id, name: r.name, companyName: r.company_name,
    email: r.email, phone: r.phone, gstNumber: r.gst_number,
    contactPerson: r.contact_person, status: r.status,
    totalSpend: r.total_spend, createdAt: r.created_at,
  }));
}

export async function getCampaigns(opts?: {
  advertiserId?: string; status?: string; limit?: number; offset?: number;
}): Promise<{ data: AdCampaign[]; count: number }> {
  let q = db.from("ad_campaigns").select("*, advertisers(name)", { count: "exact" }).order("created_at", { ascending: false });
  if (opts?.advertiserId) q = q.eq("advertiser_id", opts.advertiserId);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.limit) q = q.limit(opts.limit);
  if (opts?.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 20) - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  const items: AdCampaign[] = (data ?? []).map((r: any) => ({
    id: r.id, advertiserId: r.advertiser_id, advertiserName: r.advertisers?.name,
    name: r.name, type: r.type, status: r.status, budgetTotal: r.budget_total,
    budgetSpent: r.budget_spent, budgetDaily: r.budget_daily, billingType: r.billing_type,
    rate: r.rate, impressions: r.impressions, clicks: r.clicks, ctr: r.ctr,
    startDate: r.start_date, endDate: r.end_date, targetZones: r.target_zones ?? [],
    targetCategories: r.target_categories ?? [], notes: r.notes,
    approvedBy: r.approved_by, approvedAt: r.approved_at, rejectionReason: r.rejection_reason,
    createdAt: r.created_at, updatedAt: r.updated_at, createdBy: r.created_by,
  }));
  return { data: items, count: count ?? 0 };
}

export async function updateCampaignStatus(id: string, status: AdCampaign["status"], opts?: { approvedBy?: string; rejectionReason?: string }): Promise<void> {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (opts?.approvedBy) { updates.approved_by = opts.approvedBy; updates.approved_at = new Date().toISOString(); }
  if (opts?.rejectionReason) updates.rejection_reason = opts.rejectionReason;
  await db.from("ad_campaigns").update(updates).eq("id", id);
}

export async function getCreatives(campaignId: string): Promise<AdCreative[]> {
  const { data, error } = await db.from("ad_creatives").select("*").eq("campaign_id", campaignId).order("created_at");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, campaignId: r.campaign_id, name: r.name, type: r.type,
    imageUrl: r.image_url, htmlCode: r.html_code, linkUrl: r.link_url,
    altText: r.alt_text, size: r.size, isActive: r.is_active,
    impressions: r.impressions, clicks: r.clicks, createdAt: r.created_at,
  }));
}

export async function getAdReports(opts: { campaignId?: string; dateFrom?: string; dateTo?: string }): Promise<AdReport[]> {
  let q = db.from("ad_reports").select("*").order("date", { ascending: false });
  if (opts.campaignId) q = q.eq("campaign_id", opts.campaignId);
  if (opts.dateFrom) q = q.gte("date", opts.dateFrom);
  if (opts.dateTo) q = q.lte("date", opts.dateTo);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, campaignId: r.campaign_id, date: r.date, impressions: r.impressions,
    clicks: r.clicks, ctr: r.ctr, spend: r.spend, zoneId: r.zone_id, page: r.page,
  }));
}

export async function getPendingCampaignCount(): Promise<number> {
  const { count } = await db.from("ad_campaigns").select("id", { count: "exact", head: true }).eq("status", "pending-review");
  return count ?? 0;
}
