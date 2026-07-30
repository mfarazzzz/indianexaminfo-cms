import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, BookOpen, Users, Tag, Link2,
  FileCode, Image, BarChart2, Megaphone, Palette, MapPin,
  TrendingUp, Settings, ClipboardList, LogOut, ExternalLink,
  X, Shield, Building2, GraduationCap, Navigation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { P } from "@/config/permissions";
import { SITE } from "@/config/site";
import { useMobileNav } from "@/contexts/MobileNavContext";

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  permissions?: string[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
  permissions?: string[];
}

const ICON_SIZE = 15;

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Content",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: <LayoutDashboard size={ICON_SIZE} /> },
      { label: "Entrance Exams", to: "/entrance-exams", icon: <GraduationCap size={ICON_SIZE} />, permissions: [P.CREATE_EXAM, P.EDIT_ANY_EXAM] },
      { label: "Govt Exam", to: "/govt-exam", icon: <ClipboardList size={ICON_SIZE} />, permissions: [P.CREATE_EXAM, P.EDIT_ANY_EXAM] },
      { label: "Sarkari Bharti", to: "/sarkari-bharti", icon: <Shield size={ICON_SIZE} />, permissions: [P.CREATE_EXAM, P.EDIT_ANY_EXAM] },
      { label: "Board Exams", to: "/board-exams", icon: <BookOpen size={ICON_SIZE} />, permissions: [P.CREATE_EXAM, P.EDIT_ANY_EXAM] },
      { label: "University Exams", to: "/university-exams", icon: <Building2 size={ICON_SIZE} />, permissions: [P.CREATE_EXAM, P.EDIT_ANY_EXAM] },
      { label: "Content", to: "/content", icon: <FileCode size={ICON_SIZE} />, permissions: [P.CREATE_POST, P.EDIT_ANY_POST] },
      { label: "Blog Authors", to: "/blog/authors", icon: <Users size={ICON_SIZE} />, permissions: [P.CREATE_POST] },
    ],
  },
  {
    title: "Structure",
    permissions: [P.MANAGE_CATEGORIES, P.MANAGE_MENUS, P.MANAGE_PAGES],
    items: [
      { label: "Categories", to: "/categories", icon: <Tag size={ICON_SIZE} />, permissions: [P.MANAGE_CATEGORIES] },
      { label: "Navigation", to: "/navigation", icon: <Navigation size={ICON_SIZE} />, permissions: [P.MANAGE_MENUS] },
      { label: "Menu Manager", to: "/menus", icon: <Link2 size={ICON_SIZE} />, permissions: [P.MANAGE_MENUS] },
      { label: "Pages", to: "/pages", icon: <FileText size={ICON_SIZE} />, permissions: [P.MANAGE_PAGES] },
    ],
  },
  {
    title: "Media",
    items: [
      { label: "Media Library", to: "/media", icon: <Image size={ICON_SIZE} />, permissions: [P.UPLOAD_MEDIA] },
    ],
  },
  {
    title: "Ad Manager",
    permissions: [P.MANAGE_ADS, P.VIEW_OWN_ADS, P.MANAGE_AD_ZONES],
    items: [
      { label: "Ad Dashboard", to: "/ads", icon: <BarChart2 size={ICON_SIZE} />, permissions: [P.MANAGE_ADS, P.VIEW_OWN_ADS] },
      { label: "Campaigns", to: "/ads/campaigns", icon: <Megaphone size={ICON_SIZE} />, permissions: [P.MANAGE_ADS, P.VIEW_OWN_ADS] },
      { label: "Ad Creatives", to: "/ads/creatives", icon: <Palette size={ICON_SIZE} />, permissions: [P.MANAGE_ADS] },
      { label: "Ad Zones", to: "/ads/zones", icon: <MapPin size={ICON_SIZE} />, permissions: [P.MANAGE_AD_ZONES] },
      { label: "Reports", to: "/ads/reports", icon: <TrendingUp size={ICON_SIZE} />, permissions: [P.MANAGE_ADS] },
    ],
  },
  {
    title: "Users",
    permissions: [P.MANAGE_USERS],
    items: [
      { label: "User Management", to: "/users", icon: <Users size={ICON_SIZE} />, permissions: [P.MANAGE_USERS] },
    ],
  },
  {
    title: "System",
    permissions: [P.MANAGE_SETTINGS, P.VIEW_AUDIT_LOG],
    items: [
      { label: "Settings", to: "/settings", icon: <Settings size={ICON_SIZE} />, permissions: [P.MANAGE_SETTINGS] },
      { label: "Audit Log", to: "/audit", icon: <ClipboardList size={ICON_SIZE} />, permissions: [P.VIEW_AUDIT_LOG] },
    ],
  },
];

const ROLE_BADGE_COLORS: Record<string, string> = {
  "super-admin": "bg-purple-500/20 text-purple-300",
  admin:          "bg-blue-500/20 text-blue-300",
  editor:         "bg-green-500/20 text-green-300",
  author:         "bg-yellow-500/20 text-yellow-300",
  advertiser:     "bg-orange-500/20 text-orange-300",
};

export function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useMobileNav();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const userInitial = user?.profile.name?.[0]?.toUpperCase() ?? "?";
  const roleSlug = user?.profile.roleSlug ?? "author";
  const permissions = user?.profile.permissions ?? [];

  const canSeeItem = (item: NavItem) => {
    if (!item.permissions || item.permissions.length === 0) return true;
    return item.permissions.some((p) => permissions.includes(p));
  };

  const canSeeGroup = (group: NavGroup) => {
    if (!group.permissions || group.permissions.length === 0) return true;
    return group.permissions.some((p) => permissions.includes(p));
  };

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-[#0F172A] transition-transform duration-200",
      // Mobile: hidden by default, slides in when open
      sidebarOpen ? "translate-x-0" : "-translate-x-full",
      // Desktop: always visible
      "lg:translate-x-0 lg:z-20"
    )}>
      {/* Logo + mobile close */}
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-sm font-bold text-white">
            IE
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">IndianExamInfo</p>
            <p className="text-xs text-slate-400">CMS</p>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden rounded p-1 text-slate-400 hover:text-white hover:bg-white/10"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {NAV_GROUPS.map((group) => {
          if (!canSeeGroup(group)) return null;
          const visibleItems = group.items.filter(canSeeItem);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="mb-5">
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {group.title}
              </p>
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/dashboard"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    )
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3 space-y-2">
        {/* View Site */}
        <a
          href={SITE.frontendUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
        >
          <ExternalLink size={12} />
          View Site
        </a>

        {/* User info */}
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-semibold text-white">
            {user?.profile.avatar ? (
              <img src={user.profile.avatar} alt="" className="h-full w-full rounded-full object-cover" />
            ) : userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">{user?.profile.name}</p>
            <span className={cn("inline-block rounded px-1 py-0 text-[10px] font-medium", ROLE_BADGE_COLORS[roleSlug] ?? "bg-white/10 text-white/60")}>
              {user?.profile.roleName}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
