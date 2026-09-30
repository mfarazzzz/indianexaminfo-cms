/**
 * useNewMessageCount — the sidebar "new" badge for /messages (P3-1).
 *
 * Polls the real count of status = 'new' reader messages every minute, but
 * only for handle_messages holders (RLS would return 0 for everyone else, and
 * the item itself is hidden for them). Fail-soft: a missing table (the
 * reader_messages migration is still PROPOSED) or any error reads 0 — the
 * badge hides instead of showing a fabricated number.
 */
import { useEffect, useState } from 'react';
import { usePermission } from '@/hooks/usePermission';
import { P } from '@/config/permissions';
import { countNewMessages } from '@/services/readerMessageService';

const POLL_MS = 60_000;

export function useNewMessageCount(): number {
  const canHandle = usePermission(P.HANDLE_MESSAGES);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!canHandle) { setCount(0); return; }
    let active = true;
    const tick = () => {
      countNewMessages()
        .then((n) => { if (active) setCount(n); })
        .catch(() => { if (active) setCount(0); });
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => { active = false; clearInterval(t); };
  }, [canHandle]);

  return count;
}
