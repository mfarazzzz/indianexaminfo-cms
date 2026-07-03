import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, Loader2, KeyRound, UserX } from "lucide-react";
import { getUserProfiles, getRoles, inviteUser, updateUserProfile, sendPasswordReset } from "@/services/userService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import type { UserProfile, Role } from "@/types/user";

export function UsersListPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([getUserProfiles(), getRoles()]);
      setUsers(u);
      setRoles(r);
      if (r.length > 0 && !inviteRole) setInviteRole(r[0].id);
    } catch (err) {
      toast.error("Failed to load users: " + String(err));
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
      toast.error(String(err));
    }
  };

  const handlePasswordReset = async (email: string) => {
    const { error } = await sendPasswordReset(email);
    if (error) toast.error(error);
    else toast.success("Password reset email sent.");
  };

  const changeRole = async (userId: string, roleId: string) => {
    try {
      await updateUserProfile(userId, { roleId });
      toast.success("Role updated.");
      load();
    } catch (err) {
      toast.error(String(err));
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
                      title="Reset password" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      <KeyRound size={14} />
                    </button>
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
    </div>
  );
}
