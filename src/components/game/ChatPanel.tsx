/**
 * ЧАТ: ОБЩИЙ И ГИЛЬДЕЙСКИЙ (bigplan.md, пункты 12, 13)
 *
 * Гильдейский чат существовал в БД и в API, но UI к нему не было вообще — сообщения было
 * невозможно ни отправить, ни прочитать. Общего канала не существовало.
 *
 * Новые сообщения приходят по SSE (см. hooks/useServerStream.ts), история — обычным GET при
 * открытии панели: поток ничего не хранит и пропущенное за время разрыва не досылает.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Users, Globe, WifiOff } from 'lucide-react';
import { selectActiveMessages, useChatStore, type ChatChannel } from '../../features/chatStore';
import { useMarketStore } from '../../features/marketStore';
import { EmptyState, Tabs, type TabItem } from '../ui';

const MAX_LENGTH = 500;

/** «14:03» — в чате важно время, а не дата: история всё равно короткая. */
function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ChatPanel({ streamOnline = true }: { streamOnline?: boolean }) {
  const channel = useChatStore((s) => s.channel);
  const setChannel = useChatStore((s) => s.setChannel);
  const messages = useChatStore(selectActiveMessages);
  const loading = useChatStore((s) => s.loading);
  const error = useChatStore((s) => s.error);
  const loadGlobalHistory = useChatStore((s) => s.loadGlobalHistory);
  const loadGuildHistory = useChatStore((s) => s.loadGuildHistory);
  const sendGlobal = useChatStore((s) => s.sendGlobal);
  const sendGuild = useChatStore((s) => s.sendGuild);
  const clearUnread = useChatStore((s) => s.clearUnread);

  // Гильдия игрока: без неё вкладка «Гильдия» бессмысленна.
  const myGuild = useMarketStore((s) => s.myGuild);
  const fetchMyGuild = useMarketStore((s) => s.fetchMyGuild);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Панель открыта — значит непрочитанного нет.
  useEffect(() => {
    clearUnread();
  }, [clearUnread, messages.length]);

  useEffect(() => {
    fetchMyGuild();
  }, [fetchMyGuild]);

  // История загружается при открытии и при смене канала.
  useEffect(() => {
    if (channel === 'global') loadGlobalHistory();
    else if (myGuild?.id) loadGuildHistory(myGuild.id);
  }, [channel, myGuild?.id, loadGlobalHistory, loadGuildHistory]);

  /*
   * Автоскролл вниз при новом сообщении — но только если игрок уже был внизу. Иначе чтение
   * истории прерывалось бы прыжком вниз на каждое чужое сообщение.
   */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const tabs: TabItem<ChatChannel>[] = useMemo(
    () => [
      { id: 'global', label: 'Общий', icon: <Globe size={12} /> },
      { id: 'guild', label: 'Гильдия', icon: <Users size={12} /> },
    ],
    [],
  );

  const canSend = channel === 'global' || Boolean(myGuild?.id);

  const handleSend = async () => {
    const value = text.trim();
    if (!value || sending) return;

    setSending(true);
    const result =
      channel === 'global'
        ? await sendGlobal(value)
        : myGuild?.id
          ? await sendGuild(myGuild.id, value)
          : { ok: false as const };
    setSending(false);

    // Текст очищаем только при успехе: иначе игрок теряет написанное из-за антиспама.
    if (result.ok) setText('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <Tabs items={tabs} value={channel} onChange={setChannel} size="sm" />

      {/* Состояние канала: без этого молчащий чат не отличить от отсутствия сообщений. */}
      {!streamOnline && (
        <div className="flex items-center gap-1.5 rounded border border-cyber-orange/40 bg-cyber-orange/10 px-2 py-1 text-[10px] text-cyber-orange">
          <WifiOff size={11} />
          Нет связи с сервером — новые сообщения не приходят. Переподключаемся…
        </div>
      )}

      {channel === 'guild' && !myGuild?.id && (
        <div className="rounded border border-cyber-border bg-cyber-bg-dark px-2 py-1.5 text-[11px] text-cyber-text-dim">
          Вы не в гильдии. Вступите в гильдию во вкладке «Биржа», чтобы пользоваться этим чатом.
        </div>
      )}

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto rounded border border-cyber-border bg-cyber-black/40 p-2"
      >
        {loading && messages.length === 0 ? (
          <div className="text-xs text-cyber-text-dim">Загрузка…</div>
        ) : messages.length === 0 ? (
          <EmptyState
            title="Пока тихо"
            hint={channel === 'global' ? 'Напишите первым' : 'В гильдии ещё не переписывались'}
          />
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-xs leading-snug">
              <span className="font-mono text-[10px] text-cyber-text-dim">
                {formatTime(m.createdAt)}
              </span>{' '}
              <span className="font-medium text-cyber-blue">{m.playerName}</span>
              <span className="text-cyber-text-dim">: </span>
              {/* Текст всегда как текст: сообщения приходят от других игроков. */}
              <span className="text-cyber-text break-words">{m.message}</span>
            </div>
          ))
        )}
      </div>

      {error && <div className="text-[11px] text-cyber-red">{error}</div>}

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={(e) => {
            // Enter отправляет, Shift+Enter — перенос строки (сервер его всё равно вырежет,
            // но привычное поведение поля важнее).
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={canSend ? 'Сообщение…' : 'Недоступно'}
          disabled={!canSend}
          rows={2}
          className="min-h-0 flex-1 resize-none rounded border border-cyber-border bg-cyber-bg-dark px-2 py-1.5 text-xs text-cyber-text placeholder:text-cyber-text-dim disabled:opacity-50"
        />
        <button
          type="button"
          className="btn-primary btn-xs flex items-center gap-1"
          disabled={!canSend || sending || text.trim().length === 0}
          onClick={() => void handleSend()}
        >
          <Send size={12} />
        </button>
      </div>

      <div className="text-right text-[10px] text-cyber-text-dim">
        {text.length}/{MAX_LENGTH}
      </div>
    </div>
  );
}
