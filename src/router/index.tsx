import React, { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "./ProtectedRoute";
import { LoginPage } from "@/pages/auth/LoginPage";
import { Loader2 } from "lucide-react";

function Loading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
    </div>
  );
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
      <Suspense fallback={<Loading />}>
        <Component />
      </Suspense>
    );
  };
}

const DashboardPage     = lazyPage(() => import("@/pages/dashboard/DashboardPage"),     "DashboardPage");
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
          { path: "/users",             element: <UsersListPage /> },
          { path: "/settings",          element: <SettingsPage /> },
          { path: "/audit",             element: <AuditLogPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);
