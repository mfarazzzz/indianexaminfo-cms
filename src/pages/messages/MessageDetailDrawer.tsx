/**
 * MessageDetailDrawer — right-side panel for one reader message (S0-5 Part 3).
 *
 * Shows the full submission, the triage controls (status / priority /
 * assignee), the attributable note thread (contact_message_notes) and the
 * who-when history (contact_message_events). Every triage change is written
 * back through readerMessageService, which records a matching event row.
 *
 * Uses the caller's JWT — RLS is the authority on who may update / delete;
 * the UI only reflects handle_messages / manage_settings for affordances.
 */
import { useEffect, useState, useCallback } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  listNotes, addNote, listEvents,
  updateStatus, updatePriority, updateAssignee, deleteReaderMessage,
  type ReaderMessage, type MessageNote, type MessageEvent,
  type ReaderMessageStatus, type ReaderMessagePriority,
} from "@/services/readerMessageService";
import { getUserProfiles } from "@/services/userService";
import { usePermission } from "@/hooks/usePermission";
import { P } from "@/config/permissions";
import { MESSAGE_STATUSES, STATUS_LABELS } from "@/config/messages";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { formatDate, getErrorMessage } from "@/lib/utils";

const STATUSES: ReaderMessageStatus[] = [...MESSAGE_STATUSES];
const PRIORITIES: ReaderMessagePriority[] = ["low", "normal", "high"];

interface Props {
  message: ReaderMessage;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}

export function MessageDetailDrawer({ message, onClose, onChanged, onDeleted }: Props) {
  const canManageSettings = usePermission(P.MANAGE_SETTINGS);
  // Local snapshot so the triage selects reflect an optimistic change while
  // the parent reloads the list. Resets when a different message is opened.
  const [current, setCurrent] = useState<ReaderMessage>(message);
  useEffect(() => setCurrent(message), [message]);
  const [notes, setNotes] = useState<MessageNote[]>([]);
  const [events, setEvents] = useState<MessageEvent[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadThread = useCallback(async () => {
    try {
      const [n, e] = await Promise.all([listNotes(message.id), listEvents(message.id)]);
      setNotes(n);
      setEvents(e);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [message.id]);

  useEffect(() => {
    loadThread();
    getUserProfiles()
      .then((rows) => setUsers(rows.map((r) => ({ id: r.id, name: r.name || r.email }))))
      .catch(() => { /* assignee list is non-critical */ });
  }, [loadThread]);

  const changeStatus = async (status: ReaderMessageStatus) => {
    setCurrent((c) => ({ ...c, status }));
    setSaving(true);
    try {
      await updateStatus(message.id, status);
      await loadThread();
      onChanged();
      toast.success("Status updated.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const changePriority = async (priority: ReaderMessagePriority) => {
    setCurrent((c) => ({ ...c, priority }));
    setSaving(true);
    try {
      await updatePriority(message.id, priority);
      await loadThread();
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const changeAssignee = async (assignee: string) => {
    setCurrent((c) => ({ ...c, assignee: assignee || null }));
    setSaving(true);
    try {
      await updateAssignee(message.id, assignee || null);
      await loadThread();
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submitNote = async () => {
    if (!draftNote.trim()) return;
    setSaving(true);
    try {
      await addNote(message.id, draftNote);
      setDraftNote("");
      await loadThread();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteReaderMessage(message.id);
      toast.success("Message deleted.");
      onDeleted();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const selectCls =
    "rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{message.refNumber}</p>
            <p className="text-xs text-slate-500">
              {message.source === "contact_form" ? "Contact form" : "Report sheet"} · {message.category}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Message body */}
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Message</p>
            <p className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-700">{message.message}</p>
            {message.reason && (
              <p className="mt-1 text-xs text-slate-400">Reason tag: {message.reason.replace(/_/g, " ")}</p>
            )}
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sender</p>
              <p className="text-slate-700">{message.senderName || "—"}</p>
              {message.senderEmail && <a className="text-blue-600 hover:underline break-all" href={`mailto:${message.senderEmail}`}>{message.senderEmail}</a>}
              {message.senderPhone && <p className="text-slate-600">{message.senderPhone}</p>}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Received</p>
              <p className="text-slate-700">{formatDate(message.createdAt)}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Consent: {message.consent ? "given" : "not given"}</p>
            </div>
            {message.pageUrl && (
              <div className="col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Page</p>
                <a href={message.pageUrl} target="_blank" rel="noopener noreferrer" className="break-all text-blue-600 hover:underline">
                  {message.pageTitle || message.pageUrl}
                </a>
              </div>
            )}
          </div>

          {/* Triage controls */}
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</span>
              <select
                className={selectCls + " mt-1 w-full"}
                value={current.status}
                disabled={saving}
                onChange={(e) => changeStatus(e.target.value as ReaderMessageStatus)}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Priority</span>
              <select
                className={selectCls + " mt-1 w-full"}
                value={current.priority}
                disabled={saving}
                onChange={(e) => changePriority(e.target.value as ReaderMessagePriority)}
              >
                {PRIORITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Assignee</span>
              <select
                className={selectCls + " mt-1 w-full"}
                value={current.assignee ?? ""}
                disabled={saving}
                onChange={(e) => changeAssignee(e.target.value)}
              >
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
          </div>

          {/* Notes */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notes</p>
            <div className="space-y-2">
              {notes.length === 0 && <p className="text-xs text-slate-400">No notes yet.</p>}
              {notes.map((n) => (
                <div key={n.id} className="rounded border border-slate-100 bg-slate-50 p-2.5">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{n.note}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{n.authorName} · {formatDate(n.createdAt)}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value.slice(0, 2000))}
                rows={2}
                placeholder="Add an internal note…"
                className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={submitNote}
                disabled={saving || !draftNote.trim()}
                className="self-end rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Events */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">History</p>
            {events.length === 0 ? (
              <p className="text-xs text-slate-400">No events recorded.</p>
            ) : (
              <ol className="space-y-1.5">
                {events.map((ev) => (
                  <li key={ev.id} className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{ev.actorName}</span>{" "}
                    {ev.event.replace(/_/g, " ")}
                    {ev.newValue && (
                      <> — {ev.oldValue ? <span className="line-through">{ev.oldValue}</span> : null} {ev.oldValue ? "→" : "to"} <span className="text-slate-700">{ev.newValue}</span></>
                    )}
                    <span className="ml-1 text-slate-400">· {formatDate(ev.createdAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Footer — delete gated on manage_settings */}
        {canManageSettings && (
          <div className="border-t border-slate-200 p-3">
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> Delete message
            </button>
          </div>
        )}
      </aside>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this message?"
        description="This permanently removes the reader message, its notes and its history. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={handleDelete}
      />
    </>
  );
}

