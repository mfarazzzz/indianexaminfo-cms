import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function CampaignEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/ads/campaigns")} className="text-slate-400 hover:text-slate-700"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-semibold text-slate-900">{isNew ? "New Campaign" : "Edit Campaign"}</h1>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 text-sm">
        Campaign editor — connect to Supabase to manage campaigns.
        <br />
        <span className="text-xs text-slate-400">Full CRUD available via adService.ts</span>
      </div>
    </div>
  );
}
