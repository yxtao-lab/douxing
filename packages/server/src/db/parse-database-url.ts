export function parseDatabaseUrl(url: string) {
  const parsed = new URL(url.replace(/^mysql:\/\//, 'http://'));
  const database = parsed.pathname.replace(/^\//, '');
  let host = parsed.hostname || 'localhost';
  // Windows 上 localhost 可能走 IPv6，导致连接被重置
  if (host === 'localhost') host = '127.0.0.1';

  return {
    host,
    port: Number(parsed.port) || 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
}
