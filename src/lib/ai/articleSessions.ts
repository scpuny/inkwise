// articleSessions.ts — 按文章持久化 ChatPanel 会话记录

import type { AgentSession } from "./agent";

const SESSION_KEY_PREFIX = "sessions:";
const MAX_SESSIONS_PER_ARTICLE = 50;

export async function saveSessions(articleId: string | null, sessions: AgentSession[]): Promise<void> {
  if (!articleId) return;
  try {
    // Only save agent/command sessions (not inline/ghost)
    const agentSessions = sessions.filter(s => s.mode === "agent" || s.mode === "command");
    // Keep only recent ones
    const trimmed = agentSessions.slice(-MAX_SESSIONS_PER_ARTICLE);
    localStorage.setItem(SESSION_KEY_PREFIX + articleId, JSON.stringify(trimmed));
  } catch { /* ignore quota errors */ }
}

export async function loadSessions(articleId: string | null): Promise<AgentSession[]> {
  if (!articleId) return [];
  try {
    const raw = localStorage.getItem(SESSION_KEY_PREFIX + articleId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch { return []; }
}

export async function deleteSessions(articleId: string): Promise<void> {
  try {
    localStorage.removeItem(SESSION_KEY_PREFIX + articleId);
  } catch { /* ignore */ }
}
