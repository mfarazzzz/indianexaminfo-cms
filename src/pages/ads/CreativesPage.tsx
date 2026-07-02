import React from "react";

export function CreativesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Ad Creatives</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Manage ad creatives (images, HTML, text-links) per campaign.
        <br />
        <span className="text-xs text-slate-400">Select a campaign from Campaigns → Creatives tab to manage.</span>
      </div>
    </div>
  );
}
