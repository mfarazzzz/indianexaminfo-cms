import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, BookOpen, Tag, Users, TrendingUp, Clock, Star } from "lucide-react";
import { db } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, timeAgo } from "@/lib/utils";

interface Stats {
  totalExams: number;
  totalContent: number;
  totalBlogPosts: number;
  totalCategories: number;
  pendingReview: number;
  publishedToday: number;
}

interface RecentItem {
  id: string;
  title: string;
  type: "exam" | "content" | "blog";
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
        const [examsRes, contentRes, blogRes, catRes, reviewRes] = await Promise.all([
          db.from("exams").select("id", { count: "exact", head: true }),
          db.from("content_posts").select("id", { count: "exact", head: true }),
          db.from("blog_posts").select("id", { count: "exact", head: true }),
          db.from("categories").select("id", { count: "exact", head: true }),
          db.from("content_posts").select("id", { count: "exact", head: true }).eq("status", "review"),
        ]);

        setStats({
          totalExams: examsRes.count ?? 0,
          totalContent: contentRes.count ?? 0,
          totalBlogPosts: blogRes.count ?? 0,
          totalCategories: catRes.count ?? 0,
          pendingReview: reviewRes.count ?? 0,
          publishedToday: 0,
        });

        // Recent activity
        const [recentExams, recentContent, recentBlog] = await Promise.all([
          db.from("exams").select("id, name, status, updated_at").order("updated_at", { ascending: false }).limit(3),
          db.from("content_posts").select("id, title, status, updated_at").order("updated_at", { ascending: false }).limit(3),
          db.from("blog_posts").select("id, title, status, updated_at").order("updated_at", { ascending: false }).limit(3),
        ]);

        const items: RecentItem[] = [
          ...(recentExams.data ?? []).map((r) => ({
            id: (r as Record<string, unknown>).id as string,
            title: (r as Record<string, unknown>).name as string,
            type: "exam" as const,
            status: (r as Record<string, unknown>).status as string,
            updatedAt: (r as Record<string, unknown>).updated_at as string,
          })),
          ...(recentContent.data ?? []).map((r) => ({
            id: (r as Record<string, unknown>).id as string,
            title: (r as Record<string, unknown>).title as string,
            type: "content" as const,
            status: (r as Record<string, unknown>).status as string,
            updatedAt: (r as Record<string, unknown>).updated_at as string,
          })),
          ...(recentBlog.data ?? []).map((r) => ({
            id: (r as Record<string, unknown>).id as string,
            title: (r as Record<string, unknown>).title as string,
            type: "blog" as const,
            status: (r as Record<string, unknown>).status as string,
            updatedAt: (r as Record<string, unknown>).updated_at as string,
          })),
        ]
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 8);

        setRecent(items);
      } catch {
        // Ignore — DB may not be set up yet
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const statCards = [
    { label: "Total Exams", value: stats?.totalExams ?? "—", icon: <FileText size={18} className="text-blue-600" />, href: "/exams" },
    { label: "Content Posts", value: stats?.totalContent ?? "—", icon: <FileText size={18} className="text-indigo-600" />, href: "/content" },
    { label: "Blog Posts", value: stats?.totalBlogPosts ?? "—", icon: <BookOpen size={18} className="text-purple-600" />, href: "/blog" },
    { label: "Categories", value: stats?.totalCategories ?? "—", icon: <Tag size={18} className="text-teal-600" />, href: "/categories" },
    { label: "Pending Review", value: stats?.pendingReview ?? "—", icon: <Clock size={18} className="text-yellow-600" />, href: "/content?status=review", highlight: (stats?.pendingReview ?? 0) > 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Welcome back, {user?.profile.name?.split(" ")[0] || user?.email?.split("@")[0] || "Admin"} 👋
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Here's what's happening with IndianExamInfo today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((card) => (
          <button
            key={card.label}
            onClick={() => navigate(card.href)}
            className={`rounded-lg border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md ${
              card.highlight ? "border-yellow-300 ring-1 ring-yellow-300" : "border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="rounded bg-slate-50 p-1.5">{card.icon}</div>
              {card.highlight && (
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                  Action needed
                </span>
              )}
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {loading ? (
                <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-100" />
              ) : (
                card.value
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
          <TrendingUp size={16} className="text-slate-400" />
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="h-4 w-4 animate-pulse rounded bg-slate-100" />
                <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
              </div>
            ))
          ) : recent.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">
              No activity yet. Start by adding an exam.
            </p>
          ) : (
            recent.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/${item.type === "content" ? "content" : item.type}/${item.id}`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex-shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                    {item.type}
                  </span>
                  <span className="truncate text-sm text-slate-700">{item.title}</span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <StatusBadge status={item.status} />
                  <span className="text-xs text-slate-400">{timeAgo(item.updatedAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "New Exam", href: "/exams/new", color: "text-blue-700 bg-blue-50 hover:bg-blue-100" },
          { label: "New Content Post", href: "/content/new", color: "text-indigo-700 bg-indigo-50 hover:bg-indigo-100" },
          { label: "New Blog Post", href: "/blog/new", color: "text-purple-700 bg-purple-50 hover:bg-purple-100" },
          { label: "New Category", href: "/categories", color: "text-teal-700 bg-teal-50 hover:bg-teal-100" },
        ].map((action) => (
          <button
            key={action.href}
            onClick={() => navigate(action.href)}
            className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${action.color}`}
          >
            + {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
