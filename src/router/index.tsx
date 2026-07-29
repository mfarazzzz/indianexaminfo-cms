import React, { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "./ProtectedRoute";
import { RequirePermission } from "./RequirePermission";
import { P } from "@/config/permissions";
import { LoginPage } from "@/pages/auth/LoginPage";
import { Loader2 } from "lucide-react";

function Loading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
    </div>
  );
}

/**
 * Error boundary for lazy-loaded page chunks.
 * Handles network errors during code-splitting.
 * First retry: re-attempt the chunk load. Second: full page reload.
 */
class LazyErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; retryCount: number }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-slate-600">Failed to load this page.</p>
          <button
            onClick={() => {
              if (this.state.retryCount < 1) {
                // First retry: just reset the error boundary (React will re-attempt the lazy import)
                this.setState({ hasError: false, error: null, retryCount: this.state.retryCount + 1 });
              } else {
                // Second retry: force reload from server
                window.location.reload();
              }
            }}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function lazyPage(
  factory: () => Promise<Record<string, unknown>>,
  exportName: string
): React.ComponentType {
  const Component = lazy(() =>
    factory().then((m) => ({ default: m[exportName] as React.ComponentType }))
  );
  return function LazyWrapper() {
    return (
      <LazyErrorBoundary>
        <Suspense fallback={<Loading />}>
          <Component />
        </Suspense>
      </LazyErrorBoundary>
    );
  };
}

const DashboardPage     = lazyPage(() => import("@/pages/dashboard/DashboardPage"),     "DashboardPage");
// M3.8: Pillar-agnostic entity pages
const EntityListPage    = lazyPage(() => import("@/pages/entities/EntityListPage"),     "EntityListPage");
const EntityEditorPage  = lazyPage(() => import("@/pages/entities/EntityEditorPage"),   "EntityEditorPage");
const EntityCreationPage = lazyPage(() => import("@/pages/entities/EntityCreationPage"),"EntityCreationPage");
// M3.8: Taxonomy manager
const TaxonomyManagerPage = lazyPage(() => import("@/pages/taxonomy/TaxonomyManagerPage"), "TaxonomyManagerPage");
// Legacy pages (kept for non-entity features)
const ExamsListPage     = lazyPage(() => import("@/pages/exams/ExamsListPage"),         "ExamsListPage");
const ExamEditorPage    = lazyPage(() => import("@/pages/exams/ExamEditorPage"),        "ExamEditorPage");
const ContentListPage   = lazyPage(() => import("@/pages/content/ContentListPage"),     "ContentListPage");
const ContentEditPage   = lazyPage(() => import("@/pages/content/ContentEditPage"),     "ContentEditPage");
const BlogListPage      = lazyPage(() => import("@/pages/blog/BlogListPage"),           "BlogListPage");
const BlogEditPage      = lazyPage(() => import("@/pages/blog/BlogEditPage"),           "BlogEditPage");
const BlogAuthorsPage   = lazyPage(() => import("@/pages/blog/BlogAuthorsPage"),        "BlogAuthorsPage");
const CategoriesPage    = lazyPage(() => import("@/pages/categories/CategoriesPage"),  "CategoriesPage");
const MenusPage         = lazyPage(() => import("@/pages/menus/MenusPage"),             "MenusPage");
const PagesListPage     = lazyPage(() => import("@/pages/pages/PagesListPage"),         "PagesListPage");
const PageEditPage      = lazyPage(() => import("@/pages/pages/PageEditPage"),          "PageEditPage");
const MediaLibraryPage  = lazyPage(() => import("@/pages/media/MediaLibraryPage"),     "MediaLibraryPage");
const AdDashboardPage   = lazyPage(() => import("@/pages/ads/AdDashboardPage"),        "AdDashboardPage");
const CampaignsListPage = lazyPage(() => import("@/pages/ads/CampaignsListPage"),      "CampaignsListPage");
const CampaignEditPage  = lazyPage(() => import("@/pages/ads/CampaignEditPage"),       "CampaignEditPage");
const CreativesPage     = lazyPage(() => import("@/pages/ads/CreativesPage"),           "CreativesPage");
const ZonesPage         = lazyPage(() => import("@/pages/ads/ZonesPage"),               "ZonesPage");
const ReportsPage       = lazyPage(() => import("@/pages/ads/ReportsPage"),             "ReportsPage");
const UsersListPage     = lazyPage(() => import("@/pages/users/UsersListPage"),         "UsersListPage");
const SettingsPage      = lazyPage(() => import("@/pages/settings/SettingsPage"),       "SettingsPage");
const AuditLogPage      = lazyPage(() => import("@/pages/audit/AuditLogPage"),          "AuditLogPage");
// CMS Education News modules
const EduNewsListPage   = lazyPage(() => import("@/pages/education-news/EduNewsListPage"), "EduNewsListPage");
const EduNewsEditPage   = lazyPage(() => import("@/pages/education-news/EduNewsEditPage"), "EduNewsEditPage");
// Sarkari Naukri (Government Jobs — unified exam + direct)
const SarkariNaukriListPage = lazyPage(() => import("@/pages/sarkari-naukri/SarkariNaukriListPage"), "SarkariNaukriListPage");
const SarkariNaukriEditPage = lazyPage(() => import("@/pages/sarkari-naukri/SarkariNaukriEditPage"), "SarkariNaukriEditPage");
// Entrance Exams (dedicated editorial workflow)
const EntranceExamListPage  = lazyPage(() => import("@/pages/entrance-exams/EntranceExamListPage"),   "EntranceExamListPage");
const EntranceExamEditorPage = lazyPage(() => import("@/pages/entrance-exams/EntranceExamEditorPage"), "EntranceExamEditorPage");
// Sarkari Bharti (State Recruitments)
const SarkariBhartiListPage = lazyPage(() => import("@/pages/sarkari-bharti/SarkariBhartiListPage"), "SarkariBhartiListPage");
// University Exams
const UniversityExamsListPage = lazyPage(() => import("@/pages/university-exams/UniversityExamsListPage"), "UniversityExamsListPage");
// Board Exams
const BoardExamsListPage = lazyPage(() => import("@/pages/board-exams/BoardExamsListPage"), "BoardExamsListPage");
// Navigation Settings
const NavigationSettingsPage = lazyPage(() => import("@/pages/navigation/NavigationSettingsPage"), "NavigationSettingsPage");

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/",      element: <Navigate to="/dashboard" replace /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/dashboard",         element: <DashboardPage /> },
          // M3.8: Pillar-agnostic entity routes (zero code change for new pillars)
          { path: "/entities",             element: <EntityListPage /> },
          { path: "/entities/:pillar",     element: <EntityListPage /> },
          { path: "/entities/:pillar/new", element: <EntityCreationPage /> },
          { path: "/entities/:pillar/:id", element: <EntityEditorPage /> },
          // M3.8: Taxonomy manager
          { path: "/taxonomy",             element: <TaxonomyManagerPage /> },
          { path: "/taxonomy/:type",       element: <TaxonomyManagerPage /> },
          // Exam Manager — directly targets legacy `exams` table (what frontend reads)
          { path: "/exams",             element: <ExamsListPage /> },
          { path: "/exams/new",         element: <ExamEditorPage /> },
          { path: "/exams/:id",         element: <ExamEditorPage /> },
          { path: "/content",           element: <ContentListPage /> },
          { path: "/content/new",       element: <ContentEditPage /> },
          { path: "/content/:id",       element: <ContentEditPage /> },
          { path: "/blog",              element: <BlogListPage /> },
          { path: "/blog/authors",      element: <BlogAuthorsPage /> },
          { path: "/blog/new",          element: <BlogEditPage /> },
          { path: "/blog/:id",          element: <BlogEditPage /> },
          { path: "/categories",        element: <CategoriesPage /> },
          { path: "/navigation",        element: <NavigationSettingsPage /> },
          { path: "/menus",             element: <MenusPage /> },
          { path: "/pages",             element: <PagesListPage /> },
          { path: "/pages/new",         element: <PageEditPage /> },
          { path: "/pages/:id",         element: <PageEditPage /> },
          { path: "/media",             element: <MediaLibraryPage /> },
          { path: "/ads",               element: <AdDashboardPage /> },
          { path: "/ads/campaigns",     element: <CampaignsListPage /> },
          { path: "/ads/campaigns/new", element: <CampaignEditPage /> },
          { path: "/ads/campaigns/:id", element: <CampaignEditPage /> },
          { path: "/ads/creatives",     element: <CreativesPage /> },
          { path: "/ads/zones",         element: <ZonesPage /> },
          { path: "/ads/reports",       element: <ReportsPage /> },
          // CMS Results (LEGACY — redirects to Sarkari Naukri)
          { path: "/results",           element: <Navigate to="/sarkari-naukri" replace /> },
          { path: "/results/new",       element: <Navigate to="/sarkari-naukri/new" replace /> },
          { path: "/results/:id",       element: <Navigate to="/sarkari-naukri" replace /> },
          // CMS Education News
          { path: "/education-news",       element: <EduNewsListPage /> },
          { path: "/education-news/new",   element: <EduNewsEditPage /> },
          { path: "/education-news/:id",   element: <EduNewsEditPage /> },
          // Sarkari Naukri (Government Jobs)
          { path: "/sarkari-naukri",       element: <SarkariNaukriListPage /> },
          { path: "/sarkari-naukri/new",   element: <SarkariNaukriEditPage /> },
          { path: "/sarkari-naukri/:id",   element: <SarkariNaukriEditPage /> },
          // Entrance Exams (dedicated editorial workflow)
          { path: "/entrance-exams",       element: <EntranceExamListPage /> },
          { path: "/entrance-exams/new",   element: <EntranceExamEditorPage /> },
          { path: "/entrance-exams/:id",   element: <EntranceExamEditorPage /> },
          // Sarkari Bharti (State Recruitments)
          { path: "/sarkari-bharti",       element: <SarkariBhartiListPage /> },
          { path: "/sarkari-bharti/new",   element: <EntranceExamEditorPage /> },
          { path: "/sarkari-bharti/:id",   element: <EntranceExamEditorPage /> },
          // University Exams
          { path: "/university-exams",     element: <UniversityExamsListPage /> },
          { path: "/university-exams/new", element: <EntranceExamEditorPage /> },
          { path: "/university-exams/:id", element: <EntranceExamEditorPage /> },
          // Board Exams
          { path: "/board-exams",          element: <BoardExamsListPage /> },
          { path: "/board-exams/new",      element: <EntranceExamEditorPage /> },
          { path: "/board-exams/:id",      element: <EntranceExamEditorPage /> },
          { path: "/users",             element: <RequirePermission anyOf={[P.MANAGE_USERS]}><UsersListPage /></RequirePermission> },
          { path: "/settings",          element: <RequirePermission anyOf={[P.MANAGE_SETTINGS]}><SettingsPage /></RequirePermission> },
          { path: "/audit",             element: <RequirePermission anyOf={[P.VIEW_AUDIT_LOG]}><AuditLogPage /></RequirePermission> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);
