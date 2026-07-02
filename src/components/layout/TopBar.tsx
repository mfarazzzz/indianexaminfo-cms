import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Settings, LogOut, User } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useAuth } from "@/hooks/useAuth";
import { getReviewCount } from "@/services/contentService";
import { getPendingCampaignCount } from "@/services/adService";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
}

export function TopBar({ title, breadcrumb }: TopBarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [reviewCount, setReviewCount] = useState(0);
  const [pendingAds, setPendingAds] = useState(0);

  useEffect(() => {
    Promise.all([getReviewCount(), getPendingCampaignCount()])
      .then(([r, a]) => { setReviewCount(r); setPendingAds(a); })
      .catch(() => {});
  }, []);

  const totalBadge = reviewCount + pendingAds;
  const userInitial = user?.profile.name?.[0]?.toUpperCase() ?? "?";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <header className="fixed left-60 right-0 top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        {breadcrumb ? (
          breadcrumb.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-slate-300">/</span>}
              {crumb.href ? (
                <button
                  onClick={() => navigate(crumb.href!)}
                  className="text-slate-500 hover:text-slate-900 transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="font-medium text-slate-900">{crumb.label}</span>
              )}
            </React.Fragment>
          ))
        ) : (
          <span className="font-medium text-slate-900">{title}</span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={() => navigate("/content?status=review")}
                className="relative rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <Bell size={18} />
                {totalBadge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {totalBadge > 9 ? "9+" : totalBadge}
                  </span>
                )}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content side="bottom" className="rounded bg-slate-900 px-2 py-1 text-xs text-white">
              {reviewCount > 0 && `${reviewCount} post(s) awaiting review`}
              {reviewCount > 0 && pendingAds > 0 && " · "}
              {pendingAds > 0 && `${pendingAds} ad(s) pending approval`}
              {totalBadge === 0 && "No notifications"}
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>

        {/* User menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-300 transition-colors">
              {user?.profile.avatar ? (
                <img src={user.profile.avatar} alt="" className="h-full w-full rounded-full object-cover" />
              ) : userInitial}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="z-50 min-w-40 rounded-md border border-slate-200 bg-white py-1 shadow-md"
            >
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{user?.profile.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
              <DropdownMenu.Item
                onSelect={() => navigate("/profile")}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 outline-none"
              >
                <User size={14} /> My Profile
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => navigate("/settings")}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 outline-none"
              >
                <Settings size={14} /> Settings
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
              <DropdownMenu.Item
                onSelect={handleSignOut}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 outline-none"
              >
                <LogOut size={14} /> Sign Out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
