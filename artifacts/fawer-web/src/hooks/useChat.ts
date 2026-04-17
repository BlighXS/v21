import { useState, useCallback, useRef } from "react";
import { sendChat, type ChatMessage } from "../lib/api";
import type { AuthUser } from "../lib/api";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  error?: boolean;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useChat(
  activeModel: string,
  onGuestCountUpdate: (left: number) => void,
  onLimitReached: () => void,
  user: AuthUser | null
) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  const newConversation = useCallback(() => {
    const conv: Conversation = {
      id: genId(),
      title: "Nova conversa",
      messages: [],
      createdAt: new Date(),
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(conv.id);
    return conv.id;
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      if (!user) return;

      if (user.guest && (user.guestMessagesLeft ?? 0) <= 0) {
        onLimitReached();
        return;
      }

      let convId = activeConvId;
      if (!convId) {
        convId = newConversation();
      }

      const userMsg: Message = {
        id: genId(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                title: c.messages.length === 0 ? text.slice(0, 40) : c.title,
                messages: [...c.messages, userMsg],
              }
            : c
        )
      );

      setIsLoading(true);
      abortRef.current = new AbortController();

      try {
        const currentConv = conversations.find((c) => c.id === convId);
        const history: ChatMessage[] = (currentConv?.messages ?? []).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await sendChat(text, activeModel, history);

        if (res.limitReached) {
          onLimitReached();
          return;
        }

        if (res.guestMessagesLeft !== null) {
          onGuestCountUpdate(res.guestMessagesLeft);
        }

        const assistantMsg: Message = {
          id: genId(),
          role: "assistant",
          content: res.reply,
          provider: res.provider,
          timestamp: new Date(),
        };

        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, assistantMsg] }
              : c
          )
        );
      } catch (err) {
        const errMsg: Message = {
          id: genId(),
          role: "assistant",
          content: `Erro: ${String(err)}`,
          error: true,
          timestamp: new Date(),
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, errMsg] }
              : c
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeConvId, activeModel, conversations, isLoading, newConversation, onGuestCountUpdate, onLimitReached, user]
  );

  return {
    conversations,
    activeConv,
    activeConvId,
    setActiveConvId,
    isLoading,
    sendMessage,
    newConversation,
  };
}
