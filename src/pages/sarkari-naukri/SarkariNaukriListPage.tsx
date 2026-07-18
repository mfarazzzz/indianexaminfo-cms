import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Filter, Briefcase, GraduationCap } from "lucide-react";
import { listSarkariNaukri, getSarkariNaukriStats, type SarkariNaukri, type SarkariNaukriListOpts } from "@/services/sarkariNaukriService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import { timeAgo } from "@/lib/utils";

export function SarkariNaukriListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<SarkariNaukri[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get("type") ?? "");
  const [stateFilter, setStateFilter] = useState<string>(searchParams.get("state") ?? "");
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get("category") ?? "");
  const [stats, setStats] = useState<{ total: number; exam: number; direct: number; published: number; featured: number } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const opts: SarkariNaukriListOpts = { limit: 50 };
      if (typeFilter) opts.recruitmentType = typeFilter as any;
      if (stateFilter) opts.state = stateFilter;
      if (categoryFilter) opts.category = categoryFilter;
      if (search.trim()) opts.search = search.trim();
      const result = await listSarkariNaukri(opts);
      setItems(result.data);
      setCount(result.count);
    } catch (err) {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [typeFilter, stateFilter, categoryFilter]);
  useEffect(() => { getSarkariNaukriStats().then(setStats).catch(() => {}); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Sarkari Naukri</h1>
          <p className="text-sm text-slate-500">Government Jobs — Exam & Direct Recruitment ({count} entries)</p>
        </div>
        <button
          onClick={() => navigate("/sarkari-naukri/new")}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> New Entry
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-lg border bg-white p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
          <button onClick={() => setTypeFilter("exam")} className={`rounded-lg border p-3 text-center transition ${typeFilter === "exam" ? "border-blue-300 bg-blue-50" : "bg-white hover:bg-slate-50"}`}>
            <p className="text-2xl font-bold text-blue-600">{stats.exam}</p>
            <p className="text-xs text-slate-500">Sarkari Exam</p>
          </button>
          <button onClick={() => setTypeFilter("direct")} className={`rounded-lg border p-3 text-center transition ${typeFilter === "direct" ? "border-green-300 bg-green-50" : "bg-white hover:bg-slate-50"}`}>
            <p className="text-2xl font-bold text-green-600">{stats.direct}</p>
            <p className="text-xs text-slate-500">Sarkari Bharti</p>
          </button>
          <div className="rounded-lg border bg-white p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.published}</p>
            <p className="text-xs text-slate-500">Published</p>
          </div>
          <div className="rounded-lg border bg-white p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.featured}</p>
            <p className="text-xs text-slate-500">Featured</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, organization..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button type="submit" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">Search</button>
        </form>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          <option value="exam">Sarkari Exam</option>
          <option value="direct">Sarkari Bharti</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All Categories</option>
          <option value="ssc">SSC</option>
          <option value="railway">Railway</option>
          <option value="banking">Banking</option>
          <option value="state-psc">State PSC</option>
          <option value="defence">Defence</option>
          <option value="anganwadi">Anganwadi</option>
          <option value="panchayat">Panchayat</option>
          <option value="municipal">Municipal</option>
          <option value="hospital">Hospital</option>
          <option value="court">Court</option>
          <option value="police">Police</option>
        </select>

        {(typeFilter || categoryFilter || stateFilter) && (
          <button onClick={() => { setTypeFilter(""); setCategoryFilter(""); setStateFilter(""); }} className="text-xs text-blue-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Title</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">State</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Category</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-slate-100" /></td></tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No entries found</td></tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => navigate(`/sarkari-naukri/${item.id}`)}
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.isFeatured && <span className="text-amber-500">★</span>}
                      <span className="font-medium text-slate-800 line-clamp-1">{item.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.recruitmentType === 'exam' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                    }`}>
                      {item.recruitmentType === 'exam' ? <GraduationCap size={12} /> : <Briefcase size={12} />}
                      {item.recruitmentType === 'exam' ? 'Exam' : 'Bharti'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{item.state?.replace(/-/g, ' ') ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{item.category?.replace(/-/g, ' ') ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{timeAgo(item.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
