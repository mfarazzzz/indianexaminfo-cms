import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, BookOpen, Tag, TrendingUp, Clock, Star,
  Eye, PenTool, CheckCircle, AlertTriangle, ArrowUpRight,
  Newspaper, Briefcase, GraduationCap, Building2, BookMarked,
} from "lucide-react";
import { db } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SITE } from "@/config/site";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { formatDate, timeAgo } from "@/lib/utils";

interface Stats {
  totalExams: number;
  totalContent: number;
  totalBlogPosts: number;
  totalCategories: number;
  sarkariExam: number;
  sarkariBharti: number;
  totalEduNews: number;
  pendingReview: number;
  publishedToday: number;
  drafts: number;
  entranceExams: number;
  boardExams: number;
  universityExams: number;
  totalTaxonomyNodes: number;
}

interface RecentItem {
  id: string;
  title: string;
  slug: string;
  type: "exam" | "content" | "blog" | "sarkari-exam" | "sarkari-bharti" | "news";
  status: string;
  updatedAt: string;
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTodayIso = startOfToday.toISOString();

        const [
          examsRes, contentRes, blogRes, catRes, reviewRes,
          sarkariExamRes, sarkariBhartiRes, eduNewsRes,
          publishedContentTodayRes, publishedBlogTodayRes, publishedSarkariTodayRes,
          draftsRes, entranceRes, boardRes, universityRes, taxonomyRes,
        ] = await Promise.all([
          db.from("exams").select("id", { count: "exact", head: true }),
          db.from("content_posts").select("id", { count: "exact", head: true }),
          db.from("blog_posts").select("id", { count: "exact", head: true }),
          db.from("categories").select("id", { count: "exact", head: true }),
          db.from("content_posts").select("id", { count: "exact", head: true }).eq("status", "review"),
          db.from("sarkari_naukri").select("id", { count: "exact", head: true }).eq("recruitment_type", "exam"),
          db.from("sarkari_naukri").select("id", { count: "exact", head: true }).eq("recruitment_type", "direct"),
          db.from("cms_education_news").select("id", { count: "exact", head: true }),
          db.from("content_posts").select("id", { count: "exact", head: true }).eq("status", "published").gte("published_at", startOfTodayIso),
          db.from("blog_posts").select("id", { count: "exact", head: true }).eq("status", "published").gte("published_at", startOfTodayIso),
          db.from("sarkari_naukri").select("id", { count: "exact", head: true }).eq("workflow_status", "published").gte("published_at", startOfTodayIso),
          db.from("content_posts").select("id", { count: "exact", head: true }).eq("status", "draft"),
          db.from("exams").select("id", { count: "exact", head: true }).eq("pillar", "entrance-exam"),
          db.from("exams").select("id", { count: "exact", head: true }).eq("pillar", "board-exam"),
          db.from("exams").select("id", { count: "exact", head: true }).eq("pillar", "university-exam"),
          db.from("taxonomy_nodes").select("id", { count: "exact", head: true }),
        ]);

        setStats({
          totalExams: examsRes.count ?? 0,
          totalContent: contentRes.count ?? 0,
          totalBlogPosts: blogRes.count ?? 0,
          totalCategories: catRes.count ?? 0,
          sarkariExam: sarkariExamRes.count ?? 0,
          sarkariBharti: sarkariBhartiRes.count ?? 0,
          totalEduNews: eduNewsRes.count ?? 0,
          pendingReview: reviewRes.count ?? 0,
          publishedToday:
            (publishedContentTodayRes.count ?? 0) +
            (publishedBlogTodayRes.count ?? 0) +
            (publishedSarkariTodayRes.count ?? 0),
          drafts: draftsRes.count ?? 0,
          entranceExams: entranceRes.count ?? 0,
          boardExams: boardRes.count ?? 0,
          universityExams: universityRes.count ?? 0,
          totalTaxonomyNodes: taxonomyRes.count ?? 0,
        });

        // Recent activity
        const [recentExams, recentContent, recentBlog, recentSarkari, recentNews] = await Promise.all([
          db.from("exams").select("id, name, slug, status, updated_at").order("updated_at", { ascending: false }).limit(3),
          db.from("content_posts").select("id, title, slug, status, updated_at").order("updated_at", { ascending: false }).limit(3),
          db.from("blog_posts").select("id, title, slug, status, updated_at").order("updated_at", { ascending: false }).limit(3),
          db.from("sarkari_naukri").select("id, title, slug, recruitment_type, workflow_status, updated_at").order("updated_at", { ascending: false }).limit(4),
          db.from("cms_education_news").select("id, title, slug, status, updated_at").order("updated_at", { ascending: false }).limit(3),
        ]);

        const items: RecentItem[] = [
          ...(recentExams.data ?? []).map((r: any) => ({
            id: r.id, title: r.name, slug: r.slug ?? "", type: "exam" as const, status: r.status, updatedAt: r.updated_at,
          })),
          ...(recentContent.data ?? []).map((r: any) => ({
            id: r.id, title: r.title, slug: r.slug ?? "", type: "content" as const, status: r.status, updatedAt: r.updated_at,
          })),
          ...(recentBlog.data ?? []).map((r: any) => ({
            id: r.id, title: r.title, slug: r.slug ?? "", type: "blog" as const, status: r.status, updatedAt: r.updated_at,
          })),
          ...(recentSarkari.data ?? []).map((r: any) => ({
            id: r.id, title: r.title, slug: r.slug ?? "", type: r.recruitment_type === "exam" ? "sarkari-exam" as const : "sarkari-bharti" as const, status: r.workflow_status, updatedAt: r.updated_at,
          })),
          ...(recentNews.data ?? []).map((r: any) => ({
            id: r.id, title: r.title, slug: r.slug ?? "", type: "news" as const, status: r.status, updatedAt: r.updated_at,
          })),
        ]
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 10);

        setRecent(items);
      } catch {
        // Ignore — DB may not be set up yet
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getViewUrl = (item: RecentItem) => {
    if (item.status !== "published" || !item.slug) return null;
    if (item.type === "blog" || item.type === "content" || item.type === "news") {
      return `${SITE.frontendUrl}/news/${item.slug}`;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Welcome back, {user?.profile.name?.split(" ")[0] || user?.email?.split("@")[0] || "Admin"} 👋
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Here's what's happening with IndianExamInfo today.
          </p>
        </div>
        <a
          href={SITE.frontendUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ArrowUpRight size={14} /> View Live Site
        </a>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Published Today"
          value={stats?.publishedToday ?? 0}
          icon={<CheckCircle size={18} className="text-green-600" />}
          color="border-green-200 bg-green-50/50"
          loading={loading}
        />
        <StatCard
          label="Pending Review"
          value={stats?.pendingReview ?? 0}
          icon={<AlertTriangle size={18} className="text-amber-600" />}
          color={`border-amber-200 ${(stats?.pendingReview ?? 0) > 0 ? "bg-amber-50/50 ring-1 ring-amber-200" : "bg-amber-50/30"}`}
          href="/content?status=review"
          loading={loading}
        />
        <StatCard
          label="Drafts"
          value={stats?.drafts ?? 0}
          icon={<PenTool size={18} className="text-slate-600" />}
          color="border-slate-200 bg-slate-50/50"
          href="/content?status=draft"
          loading={loading}
        />
        <StatCard
          label="Taxonomy Nodes"
          value={stats?.totalTaxonomyNodes ?? 0}
          icon={<Tag size={18} className="text-purple-600" />}
          color="border-purple-200 bg-purple-50/50"
          href="/navigation"
          loading={loading}
        />
      </div>

      {/* Content Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard label="Total Exams" value={stats?.totalExams ?? 0} icon={<FileText size={18} className="text-blue-600" />} href="/exams" loading={loading} />
        <StatCard label="Govt Exam" value={stats?.sarkariExam ?? 0} icon={<Star size={18} className="text-orange-600" />} href="/govt-exam" loading={loading} />
        <StatCard label="Sarkari Bharti" value={stats?.sarkariBharti ?? 0} icon={<Briefcase size={18} className="text-green-600" />} href="/sarkari-bharti" loading={loading} />
        <StatCard label="Entrance Exams" value={stats?.entranceExams ?? 0} icon={<GraduationCap size={18} className="text-indigo-600" />} href="/entrance-exams" loading={loading} />
        <StatCard label="Board Exams" value={stats?.boardExams ?? 0} icon={<BookMarked size={18} className="text-pink-600" />} href="/board-exams" loading={loading} />
        <StatCard label="University Exams" value={stats?.universityExams ?? 0} icon={<Building2 size={18} className="text-teal-600" />} href="/university-exams" loading={loading} />
        <StatCard label="Education News" value={stats?.totalEduNews ?? 0} icon={<Newspaper size={18} className="text-red-600" />} href="/education-news" loading={loading} />
        <StatCard label="Content Posts" value={stats?.totalContent ?? 0} icon={<FileText size={18} className="text-indigo-600" />} href="/content" loading={loading} />
        <StatCard label="Blog Posts" value={stats?.totalBlogPosts ?? 0} icon={<BookOpen size={18} className="text-purple-600" />} href="/blog" loading={loading} />
        <StatCard label="Categories" value={stats?.totalCategories ?? 0} icon={<Tag size={18} className="text-slate-600" />} href="/categories" loading={loading} />
      </div>

      {/* Recent Activity + Quick Actions side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Recent Activity */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
            <TrendingUp size={16} className="text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="h-4 w-4 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
                </div>
              ))
            ) : recent.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">No activity yet.</p>
            ) : (
              recent.map((item) => {
                const viewUrl = getViewUrl(item);
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      onClick={() => {
                        const pathMap: Record<string, string> = {
                          exam: "exams", blog: "blog", content: "content",
                          "sarkari-exam": "sarkari-naukri", "sarkari-bharti": "sarkari-naukri", news: "education-news",
                        };
                        navigate(`/${pathMap[item.type] || "content"}/${item.id}`);
                      }}
                    >
                      <span className="flex-shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                        {item.type}
                      </span>
                      <span className="truncate text-sm text-slate-700">{item.title}</span>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {viewUrl && (
                        <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="rounded p-1 text-green-500 hover:bg-green-50" title="View on site">
                          <ArrowUpRight size={13} />
                        </a>
                      )}
                      <StatusBadge status={item.status} />
                      <span className="text-xs text-slate-400 w-12 text-right">{timeAgo(item.updatedAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Actions Sidebar */}
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: "New Exam", href: "/exams/new", color: "text-blue-700 bg-blue-50 hover:bg-blue-100" },
                { label: "New Sarkari Naukri", href: "/sarkari-naukri/new", color: "text-orange-700 bg-orange-50 hover:bg-orange-100" },
                { label: "New Education News", href: "/education-news/new", color: "text-green-700 bg-green-50 hover:bg-green-100" },
                { label: "New Content Post", href: "/content/new", color: "text-indigo-700 bg-indigo-50 hover:bg-indigo-100" },
                { label: "New Blog Post", href: "/blog/new", color: "text-purple-700 bg-purple-50 hover:bg-purple-100" },
                { label: "Manage Taxonomy", href: "/navigation", color: "text-teal-700 bg-teal-50 hover:bg-teal-100" },
              ].map((action) => (
                <button
                  key={action.href}
                  onClick={() => navigate(action.href)}
                  className={`w-full rounded-md px-3 py-2 text-sm font-medium text-left transition-colors ${action.color}`}
                >
                  + {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Site Links */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Live Site</h3>
            <div className="space-y-1.5">
              {[
                { label: "Homepage", href: SITE.frontendUrl },
                { label: "News & Blog", href: `${SITE.frontendUrl}/news` },
                { label: "Govt Exams", href: `${SITE.frontendUrl}/government-exam` },
                { label: "Entrance Exams", href: `${SITE.frontendUrl}/entrance-exam` },
                { label: "Board Exams", href: `${SITE.frontendUrl}/board-exam` },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-primary transition-colors"
                >
                  {link.label}
                  <ArrowUpRight size={12} className="text-slate-400" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Module Activity Feed */}
      <ActivityFeed limit={15} />
    </div>
  );
}

// ── Stat Card Component ─────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  href,
  color,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  href?: string;
  color?: string;
  loading: boolean;
}) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => href && navigate(href)}
      className={`rounded-lg border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md ${color ?? "border-slate-200"}`}
    >
      <div className="flex items-center justify-between">
        <div className="rounded bg-slate-50 p-1.5">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">
        {loading ? (
          <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-100" />
        ) : (
          value.toLocaleString()
        )}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </button>
  );
}
