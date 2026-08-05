/**
 * ЧАТ: ОБЩИЙ И ГИЛЬДЕЙСКИЙ (bigplan.md, пункты 12, 13)
 *
 * История подтягивается обычным GET при открытии панели, новые сообщения приходят по SSE
 * (см. utils/serverStream.ts). Разделение осознанное: поток ничего не хранит и пропущенное
 * во время разрыва не досылает, поэтому единственный способ увидеть прошлое — запросить его.
 */

import { create } from 'zustand';
import type { ChatMessagePayload } from '../utils/serverStream';
import { getAuthHeaders } from '../utils/settingsApi';

const API_URL = import.meta.env.VITE_API_URL || '';

export type ChatChannel = 'global' | 'guild';

/** Сколько сообщений держим в памяти на канал. */
const MAX_MESSAGES = 200;

interface ChatState {
  channel: ChatChannel;
  global: ChatMessagePayload[];
  guild: ChatMessagePayload[];
  loading: boolean;
  error: string | null;
  /** Сообщений, пришедших пока панель чата закрыта — для бейджа на кнопке. */
  unread: number;

  setChannel: (channel: ChatChannel) => void;
  /** Принять сообщение из SSE. */
  receive: (message: ChatMessagePayload, isChatOpen: boolean) => void;
  clearUnread: () => void;

  loadGlobalHistory: () => Promise<void>;
  loadGuildHistory: (guildId: string) => Promise<void>;
  sendGlobal: (text: string) => Promise<{ ok: boolean; error?: string }>;
  sendGuild: (guildId: string, text: string) => Promise<{ ok: boolean; error?: string }>;
  reset: () => void;
}

/** Понятный текст вместо кода ошибки сервера. */
function humanizeError(code: string | undefined): string {
  switch (code) {
    case 'TOO_FAST':
      return 'Слишком часто — подождите секунду';
    case 'TOO_MANY_MESSAGES':
      return 'Слишком много сообщений подряд, подождите немного';
    case 'INVALID_MESSAGE':
      return 'Сообщение пустое или слишком длинное';
    case 'NOT_IN_GUILD':
      return 'Вы не состоите в гильдии';
    default:
      return code ? `Ошибка: ${code}` : 'Не удалось отправить сообщение';
  }
}

/**
 * Добавить сообщение, не допустив дубликата.
 *
 * Дубликат реален: отправитель получает сообщение и в ответе на POST, и в своей же
 * SSE-рассылке, если сервер когда-нибудь начнёт присылать его и автору.
 */
function append(list: ChatMessagePayload[], message: ChatMessagePayload): ChatMessagePayload[] {
  if (list.some((m) => m.id === message.id)) return list;
  const next = [...list, message];
  return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
}

export const useChatStore = create<ChatState>((set) => ({
  channel: 'global',
  global: [],
  guild: [],
  loading: false,
  error: null,
  unread: 0,

  setChannel: (channel) => set({ channel, error: null }),

  receive: (message, isChatOpen) => {
    set((state) => {
      const key = message.channel === 'guild' ? 'guild' : 'global';
      const updated = append(state[key], message);
      if (updated === state[key]) return state;

      return {
        [key]: updated,
        // Счётчик растёт только когда панель закрыта: иначе бейдж висел бы при открытом чате.
        unread: isChatOpen ? state.unread : state.unread + 1,
      } as Partial<ChatState>;
    });
  },

  clearUnread: () => set((state) => (state.unread === 0 ? state : { unread: 0 })),

  loadGlobalHistory: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/chat/global`, { headers: getAuthHeaders() });
      const data = await response.json();
      if (!data.ok) {
        set({ loading: false, error: humanizeError(data.error) });
        return;
      }
      set({ global: (data.messages ?? []).slice(-MAX_MESSAGES), loading: false });
    } catch (e) {
      set({ loading: false, error: 'Нет связи с сервером' });
      console.warn('[chat] история общего чата:', e);
    }
  },

  loadGuildHistory: async (guildId) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/guilds/${guildId}/chat`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) {
        set({ loading: false, error: humanizeError(data.error) });
        return;
      }
      // Гильдейский эндпоинт существовал до этой работы и channel не проставляет.
      const messages: ChatMessagePayload[] = (data.messages ?? []).map(
        (m: ChatMessagePayload) => ({ ...m, channel: 'guild' as const }),
      );
      set({ guild: messages.slice(-MAX_MESSAGES), loading: false });
    } catch (e) {
      set({ loading: false, error: 'Нет связи с сервером' });
      console.warn('[chat] история чата гильдии:', e);
    }
  },

  sendGlobal: async (text) => {
    try {
      const response = await fetch(`${API_URL}/api/chat/global`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json();
      if (!data.ok) {
        const error = humanizeError(data.error);
        set({ error });
        return { ok: false, error };
      }
      /*
       * Своё сообщение добавляем из ответа: сервер рассылает по SSE всем, и автор в эту
       * рассылку попадает — но полагаться на возврат по сети для собственного действия значит
       * показывать задержку там, где её быть не должно. Дубликат отсекается по id в append().
       */
      set((state) => ({ global: append(state.global, data.message), error: null }));
      return { ok: true };
    } catch {
      const error = 'Нет связи с сервером';
      set({ error });
      return { ok: false, error };
    }
  },

  sendGuild: async (guildId, text) => {
    try {
      const response = await fetch(`${API_URL}/api/guilds/${guildId}/chat`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json();
      if (!data.ok) {
        const error = humanizeError(data.error);
        set({ error });
        return { ok: false, error };
      }
      set((state) => ({
        guild: append(state.guild, { ...data.message, channel: 'guild' }),
        error: null,
      }));
      return { ok: true };
    } catch {
      const error = 'Нет связи с сервером';
      set({ error });
      return { ok: false, error };
    }
  },

  reset: () => set({ global: [], guild: [], unread: 0, error: null, loading: false }),
}));

/** Текущий список сообщений выбранного канала. */
export function selectActiveMessages(state: ChatState): ChatMessagePayload[] {
  return state.channel === 'guild' ? state.guild : state.global;
}
