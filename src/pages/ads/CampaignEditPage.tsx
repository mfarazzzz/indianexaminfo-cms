import { getErrorMessage } from "@/lib/utils";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Plus, Trash2 } from "lucide-react";
import {
  getAdvertisers, getCampaignById, createCampaign, updateCampaign,
  getCreatives, createCreative, deleteCreative,
} from "@/services/adService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import type { AdCampaign, AdCreative, Advertiser } from "@/types/ad";

const schema = z.object({
  advertiserId:  z.string().min(1, "Advertiser required"),
  name:          z.string().min(1, "Name required"),
  type:          z.enum(["display", "sponsored-post", "category-takeover"]).optional(),
  billingType:   z.enum(["CPM", "CPC", "flat-rate"]).optional(),
  rate:          z.number().min(0).default(0),
  budgetTotal:   z.number().min(1, "Budget required"),
  budgetDaily:   z.number().min(0).default(0),
  startDate:     z.string().optional(),
  endDate:       z.string().optional(),
  notes:         z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const creativeSchema = z.object({
  name:     z.string().min(1, "Name required"),
  type:     z.enum(["image", "html", "text-link"]).optional(),
  linkUrl:  z.string().url("Must be a valid URL"),
  altText:  z.string().optional(),
  imageUrl: z.string().optional(),
  htmlCode: z.string().optional(),
});
type CreativeFormData = z.infer<typeof creativeSchema>;

export function CampaignEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [campaign, setCampaign] = useState<AdCampaign | null>(null);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [creatives, setCreatives] = useState<AdCreative[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "creatives">("details");
  const [showCreativeForm, setShowCreativeForm] = useState(false);
  const [savingCreative, setSavingCreative] = useState(false);
  const [deletingCreative, setDeletingCreative] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rate: 0, budgetTotal: 0, budgetDaily: 0 },
  });
  const { register, handleSubmit, reset, formState: { errors } } = form;

  const creativeForm = useForm<CreativeFormData>({
    resolver: zodResolver(creativeSchema),
  });

  useEffect(() => {
    getAdvertisers()
      .then(setAdvertisers)
      .catch((err) => toast.error("Failed to load advertisers: " + getErrorMessage(err)));

    if (!isNew && id) {
      setLoading(true);
      getCampaignById(id)
        .then((c) => {
          if (!c) { navigate("/ads/campaigns"); return; }
          setCampaign(c);
          reset({
            advertiserId: c.advertiserId, name: c.name,
            type: c.type as FormData["type"] ?? undefined,
            billingType: c.billingType as FormData["billingType"] ?? undefined,
            rate: c.rate, budgetTotal: c.budgetTotal, budgetDaily: c.budgetDaily,
            startDate: c.startDate ?? undefined, endDate: c.endDate ?? undefined,
            notes: c.notes ?? undefined,
          });
        })
        .catch((err) => { toast.error("Failed to load campaign: " + getErrorMessage(err)); navigate("/ads/campaigns"); })
        .finally(() => setLoading(false));
    }
  }, [id, isNew, navigate, reset]);

  useEffect(() => {
    if (!isNew && id && activeTab === "creatives") {
      getCreatives(id)
        .then(setCreatives)
        .catch((err) => toast.error("Failed to load creatives: " + getErrorMessage(err)));
    }
  }, [activeTab, id, isNew]);

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      if (isNew) {
        const c = await createCampaign({ ...data, createdBy: user?.id });
        toast.success("Campaign created.");
        navigate(`/ads/campaigns/${c.id}`, { replace: true });
      } else {
        await updateCampaign(id!, data);
        toast.success("Campaign saved.");
      }
    } catch (err) {
      toast.error("Save failed: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onAddCreative = async (data: CreativeFormData) => {
    if (!id) return;
    setSavingCreative(true);
    try {
      const c = await createCreative({ campaignId: id, ...data });
      setCreatives((prev) => [...prev, c]);
      creativeForm.reset();
      setShowCreativeForm(false);
      toast.success("Creative added.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingCreative(false);
    }
  };

  const handleDeleteCreative = async (creativeId: string) => {
    setDeletingCreative(creativeId);
    try {
      await deleteCreative(creativeId);
      setCreatives((prev) => prev.filter((c) => c.id !== creativeId));
      toast.success("Creative deleted.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingCreative(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/ads/campaigns")} className="text-slate-400 hover:text-slate-700">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {isNew ? "New Campaign" : campaign?.name ?? "Edit Campaign"}
            </h1>
            {campaign && (
              <StatusBadge status={campaign.status} />
            )}
          </div>
        </div>
        {activeTab === "details" && (
          <button onClick={handleSubmit(onSubmit)} disabled={saving}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isNew ? "Create Campaign" : "Save Changes"}
          </button>
        )}
      </div>

      {/* Tabs (only show when editing) */}
      {!isNew && (
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
          {(["details", "creatives"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`rounded px-4 py-1.5 text-sm font-medium capitalize transition-colors ${activeTab === tab ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Details tab */}
      {activeTab === "details" && (
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-5">
            {/* Basic info */}
            <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Campaign Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="form-label">Campaign Name *</label>
                  <input {...register("name")}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="form-label">Advertiser *</label>
                  <select {...register("advertiserId")}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="">Select advertiser…</option>
                    {advertisers.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}{a.companyName ? ` (${a.companyName})` : ""}</option>
                    ))}
                  </select>
                  {errors.advertiserId && <p className="mt-1 text-xs text-red-600">{errors.advertiserId.message}</p>}
                </div>
                <div>
                  <label className="form-label">Campaign Type</label>
                  <select {...register("type")}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="">Select type…</option>
                    <option value="display">Display</option>
                    <option value="sponsored-post">Sponsored Post</option>
                    <option value="category-takeover">Category Takeover</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Budget & billing */}
            <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Budget & Billing</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Billing Type</label>
                  <select {...register("billingType")}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="">Select billing…</option>
                    <option value="CPM">CPM (per 1000 impressions)</option>
                    <option value="CPC">CPC (per click)</option>
                    <option value="flat-rate">Flat Rate</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Rate (₹)</label>
                  <input {...register("rate", { valueAsNumber: true })} type="number" step="0.01"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="form-label">Total Budget (₹) *</label>
                  <input {...register("budgetTotal", { valueAsNumber: true })} type="number"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  {errors.budgetTotal && <p className="mt-1 text-xs text-red-600">{errors.budgetTotal.message}</p>}
                </div>
                <div>
                  <label className="form-label">Daily Budget (₹)</label>
                  <input {...register("budgetDaily", { valueAsNumber: true })} type="number"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
            </section>

            {/* Schedule */}
            <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">Schedule</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Start Date</label>
                  <input {...register("startDate")} type="date"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="form-label">End Date</label>
                  <input {...register("endDate")} type="date"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
            </section>

            {/* Notes */}
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Notes</h2>
              <textarea {...register("notes")} rows={3}
                className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Internal notes for this campaign…" />
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {campaign && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Performance</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-slate-50 p-2">
                    <p className="text-slate-500">Impressions</p>
                    <p className="font-semibold text-slate-900">{campaign.impressions.toLocaleString()}</p>
                  </div>
                  <div className="rounded bg-slate-50 p-2">
                    <p className="text-slate-500">Clicks</p>
                    <p className="font-semibold text-slate-900">{campaign.clicks.toLocaleString()}</p>
                  </div>
                  <div className="rounded bg-slate-50 p-2">
                    <p className="text-slate-500">CTR</p>
                    <p className="font-semibold text-slate-900">{campaign.ctr.toFixed(2)}%</p>
                  </div>
                  <div className="rounded bg-slate-50 p-2">
                    <p className="text-slate-500">Spent</p>
                    <p className="font-semibold text-slate-900">₹{campaign.budgetSpent.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Save</h3>
              <button type="submit" disabled={saving}
                className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving…" : isNew ? "Create Campaign" : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Creatives tab */}
      {activeTab === "creatives" && !isNew && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Ad Creatives</h2>
            <button onClick={() => setShowCreativeForm(true)}
              className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus size={14} /> Add Creative
            </button>
          </div>

          {/* Creatives table */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {["Name", "Type", "Link URL", "Active", "Impressions", "Clicks", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {creatives.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                      No creatives yet. Add one to get started.
                    </td>
                  </tr>
                ) : creatives.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 capitalize">{c.type ?? "—"}</td>
                    <td className="px-4 py-3 max-w-48 truncate text-xs text-slate-500">{c.linkUrl}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block h-2 w-2 rounded-full ${c.isActive ? "bg-green-400" : "bg-slate-300"}`} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDeleteCreative(c.id)}
                        disabled={deletingCreative === c.id}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                        {deletingCreative === c.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add creative form */}
          {showCreativeForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                <h3 className="mb-4 text-base font-semibold text-slate-900">Add Creative</h3>
                <form onSubmit={creativeForm.handleSubmit(onAddCreative)} className="space-y-3">
                  <div>
                    <label className="form-label text-xs">Name *</label>
                    <input {...creativeForm.register("name")}
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                    {creativeForm.formState.errors.name && (
                      <p className="mt-1 text-xs text-red-600">{creativeForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="form-label text-xs">Type</label>
                    <select {...creativeForm.register("type")}
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                      <option value="">Select type…</option>
                      <option value="image">Image</option>
                      <option value="html">HTML</option>
                      <option value="text-link">Text Link</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label text-xs">Destination URL *</label>
                    <input {...creativeForm.register("linkUrl")} type="url" placeholder="https://…"
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                    {creativeForm.formState.errors.linkUrl && (
                      <p className="mt-1 text-xs text-red-600">{creativeForm.formState.errors.linkUrl.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="form-label text-xs">Image URL</label>
                    <input {...creativeForm.register("imageUrl")} placeholder="https://…"
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="form-label text-xs">Alt Text</label>
                    <input {...creativeForm.register("altText")}
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => { setShowCreativeForm(false); creativeForm.reset(); }}
                      className="rounded border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      Cancel
                    </button>
                    <button type="submit" disabled={savingCreative}
                      className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                      {savingCreative && <Loader2 size={14} className="animate-spin" />}
                      Add Creative
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
