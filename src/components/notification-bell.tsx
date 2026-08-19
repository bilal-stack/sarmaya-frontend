'use client';

/**
 * The bell.
 *
 * Email is where a notification goes to be missed — the people who approve
 * things are not sitting in a shared AP mailbox all day. Every notification
 * also lands in the app, and this is where they see it.
 *
 * Deliberately not a second inbox. The Decision Inbox is the record of what
 * you must *do*; this is a record of what you were *told*, which is a shorter-
 * lived question. Reading a notification here does not clear the work it
 * describes, so every item still links back to the thing itself.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { API_ENDPOINTS, apiFetch } from '@/lib/api-config';
import { parseApiDate } from '@/lib/datetime';
import type { MyNotification } from '@/types/notifications';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/** Quiet enough not to hammer the API, often enough to feel live. */
const POLL_MS = 60_000;

export function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();

  const [items, setItems] = useState<MyNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.access_token) return;
    try {
      const response = await apiFetch(
        `${API_ENDPOINTS.NOTIFICATIONS.MINE}?limit=20`, {}, user.access_token
      );
      if (!response.ok) return;   // a failing bell must never break the page
      const body = await response.json();
      setItems(body.items ?? []);
      setUnread(body.unread ?? 0);
    } catch {
      // Same reasoning: the bell is an accessory to every screen it sits on.
    }
  }, [user]);

  useEffect(() => {
    if (!user?.access_token) return;
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [user, load]);

  const openNotification = async (notification: MyNotification) => {
    if (!user?.access_token) return;
    if (!notification.read_at) {
      apiFetch(
        API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notification.id),
        { method: 'POST' },
        user.access_token
      ).then(load).catch(() => {});
    }
    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  };

  const markAllRead = async () => {
    if (!user?.access_token) return;
    setBusy(true);
    try {
      await apiFetch(
        API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ, { method: 'POST' },
        user.access_token
      );
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
        }>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-medium">
            Notifications{unread > 0 && ` (${unread} unread)`}
          </p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={markAllRead}>
              {busy ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>
        <Separator />

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nothing yet</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="divide-y">
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                    n.read_at ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                    <div className={`min-w-0 ${n.read_at ? 'pl-4' : ''}`}>
                      <p className="text-sm leading-snug">{n.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(parseApiDate(n.created_at), {
                          addSuffix: true,
                        })}
                        {n.category && ` · ${n.category.replace(/_/g, ' ')}`}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
