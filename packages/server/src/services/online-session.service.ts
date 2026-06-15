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

export function listOnlineSessions(filter?: { keyword?: string }): OnlineSession[] {
  pruneExpired();
  const keyword = filter?.keyword?.trim().toLowerCase();
  let rows = [...sessions.values()];
  if (keyword) {
    rows = rows.filter(
      (row) =>
        row.username.toLowerCase().includes(keyword) ||
        row.nickname.toLowerCase().includes(keyword) ||
        row.ip.toLowerCase().includes(keyword),
    );
  }
  return rows.sort(
    (a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime(),
  );
}

export function removeOnlineSession(userId: number) {
  sessions.delete(userId);
}
