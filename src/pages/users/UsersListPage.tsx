import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, Loader2, KeyRound, UserX, KeySquare, Copy, X } from "lucide-react";
import { getUserProfiles, getRoles, inviteUser, updateUserProfile, sendPasswordReset, setTemporaryPassword } from "@/services/userService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate , getErrorMessage } from "@/lib/utils";
import { usePermission } from "@/hooks/usePermission";
import { P } from "@/config/permissions";
import type { UserProfile, Role } from "@/types/user";

export function UsersListPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviting, setInviting] = useState(false);
  const canManageUsers = usePermission(P.MANAGE_USERS);
  // Temporary-password modal state. The password is held in component state only long
  // enough to show it once; it is never persisted.
  const [tempPwFor, setTempPwFor] = useState<UserProfile | null>(null);
  const [tempPwValue, setTempPwValue] = useState<string | null>(null);
  const [tempPwLoading, setTempPwLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([getUserProfiles(), getRoles()]);
      setUsers(u);
      setRoles(r);
      if (r.length > 0 && !inviteRole) setInviteRole(r[0].id);
    } catch (err) {
      toast.error("Failed to load users: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail || !inviteRole) return;
    setInviting(true);
    try {
      const { error } = await inviteUser(inviteEmail, inviteRole);
      if (error) toast.error(error);
      else {
        toast.success(`Invite sent to ${inviteEmail}`);
        setInviteEmail("");
        setShowInvite(false);
      }
    } finally {
      setInviting(false);
    }
  };

  const toggleActive = async (user: UserProfile) => {
    try {
      await updateUserProfile(user.id, { isActive: !user.isActive });
      toast.success(`User ${user.isActive ? "deactivated" : "reactivated"}.`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handlePasswordReset = async (email: string) => {
    const { error } = await sendPasswordReset(email);
    if (error) toast.error(error);
    else toast.success("Password reset email sent.");
  };

  const handleSetTempPassword = async (user: UserProfile) => {
    setTempPwLoading(true);
    setTempPwFor(user);
    setTempPwValue(null);
    try {
      const { tempPassword, error } = await setTemporaryPassword(user.id);
      if (error) {
        toast.error(error);
        setTempPwFor(null);
        return;
      }
      setTempPwValue(tempPassword);
      load(); // refresh so must_change_password state is current
    } finally {
      setTempPwLoading(false);
    }
  };

  const changeRole = async (userId: string, roleId: string) => {
    try {
      await updateUserProfile(userId, { roleId });
      toast.success("Role updated.");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
        <button onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <UserPlus size={16} /> Invite User
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-3 text-sm font-medium text-blue-900">Invite New User</p>
          <div className="flex gap-3">
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address" className="flex-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none">
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button onClick={handleInvite} disabled={inviting}
              className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {inviting && <Loader2 size={14} className="animate-spin" />}
              Send Invite
            </button>
            <button onClick={() => setShowInvite(false)} className="rounded border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Last Login</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                  ))}
                </tr>
              ))
            ) : users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                      {(user.name?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{user.id.slice(0, 8)}…</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select defaultValue={user.roleId} onChange={(e) => changeRole(user.id, e.target.value)}
                    className="rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none">
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={user.isActive ? "active" : "unpublished"} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {user.lastLogin ? formatDate(user.lastLogin) : "Never"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => handlePasswordReset(user.email)}
                      title="Send password reset email" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      <KeyRound size={14} />
                    </button>
                    {canManageUsers && (
                      <button onClick={() => handleSetTempPassword(user)}
                        title="Set temporary password (for when email fails)"
                        className="rounded p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600">
                        <KeySquare size={14} />
                      </button>
                    )}
                    <button onClick={() => toggleActive(user)}
                      title={user.isActive ? "Deactivate" : "Reactivate"}
                      className={`rounded p-1.5 ${user.isActive ? "text-slate-400 hover:bg-red-50 hover:text-red-600" : "text-slate-400 hover:bg-green-50 hover:text-green-600"}`}>
                      <UserX size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Temporary-password modal — shows the generated password ONCE. */}
      {tempPwFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Temporary password</h2>
              <button
                onClick={() => { setTempPwFor(null); setTempPwValue(null); }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            {tempPwLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : tempPwValue ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  For <span className="font-medium text-slate-900">{tempPwFor.name || tempPwFor.email}</span>.
                  This is shown once and is not stored anywhere. Copy it now and share it
                  through a secure channel.
                </p>
                <div className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                  <code className="flex-1 select-all font-mono text-sm text-slate-900 break-all">
                    {tempPwValue}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(tempPwValue);
                      toast.success("Copied.");
                    }}
                    title="Copy"
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                  The user must change this password at their next sign-in before they can
                  reach anything else.
                </p>
                <button
                  onClick={() => { setTempPwFor(null); setTempPwValue(null); }}
                  className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
