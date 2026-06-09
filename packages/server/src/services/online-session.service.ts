interface OnlineSession {
  userId: number;
  username: string;
  nickname: string;
  ip: string;
  loginTime: string;
  lastActive: string;
}

const sessions = new Map<number, OnlineSession>();

const ONLINE_TTL_MS = 30 * 60 * 1000;

function pruneExpired() {
  const now = Date.now();
  for (const [userId, session] of sessions) {
    if (now - new Date(session.lastActive).getTime() > ONLINE_TTL_MS) {
      sessions.delete(userId);
    }
  }
}

export function touchOnlineSession(input: {
  userId: number;
  username: string;
  nickname: string;
  ip: string;
  isLogin?: boolean;
}) {
  const existing = sessions.get(input.userId);
  const now = new Date().toISOString();
  sessions.set(input.userId, {
    userId: input.userId,
    username: input.username,
    nickname: input.nickname,
    ip: input.ip,
    loginTime: input.isLogin ? now : (existing?.loginTime ?? now),
    lastActive: now,
  });
}

export function listOnlineSessions(): OnlineSession[] {
  pruneExpired();
  return [...sessions.values()].sort(
    (a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime(),
  );
}

export function removeOnlineSession(userId: number) {
  sessions.delete(userId);
}
