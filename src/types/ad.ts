export type AdZone = {
  id: string;
  slug: string;
  name: string;
  size: string;
  position: string;
  pagePlacement: string;
  description: string | null;
  isActive: boolean;
  fallbackHtml: string | null;
  createdAt: string;
};

export type Advertiser = {
  id: string;
  userId: string | null;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  gstNumber: string | null;
  contactPerson: string | null;
  status: "active" | "inactive" | "suspended";
  totalSpend: number;
  createdAt: string;
};

export type CampaignStatus =
  | "draft"
  | "pending-review"
  | "active"
  | "paused"
  | "completed"
  | "rejected";

export type AdCampaign = {
  id: string;
  advertiserId: string;
  advertiserName?: string;
  name: string;
  type: "display" | "sponsored-post" | "category-takeover" | null;
  status: CampaignStatus;
  budgetTotal: number;
  budgetSpent: number;
  budgetDaily: number;
  billingType: "CPM" | "CPC" | "flat-rate" | null;
  rate: number;
  impressions: number;
  clicks: number;
  ctr: number;
  startDate: string | null;
  endDate: string | null;
  targetZones: string[];
  targetCategories: string[];
  notes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
};

export type AdCreative = {
  id: string;
  campaignId: string;
  name: string;
  type: "image" | "html" | "text-link" | null;
  imageUrl: string | null;
  htmlCode: string | null;
  linkUrl: string;
  altText: string | null;
  size: string | null;
  isActive: boolean;
  impressions: number;
  clicks: number;
  createdAt: string;
};

export type AdReport = {
  id: string;
  campaignId: string;
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  zoneId: string | null;
  page: string | null;
};
