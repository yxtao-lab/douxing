/** Langfuse 观测配置（Step 11） */



export function isLangfuseEnabled(): boolean {

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();

  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();

  return Boolean(publicKey && secretKey);

}



export function getLangfuseHost(): string {

  const baseUrl = (process.env.LANGFUSE_BASE_URL ?? process.env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com').trim();

  return baseUrl.replace(/\/+$/, '');

}



export function getLangfuseTracingEnvironment(): string {
  const env = (process.env.LANGFUSE_TRACING_ENVIRONMENT ?? 'default').trim();
  return env || 'default';
}


