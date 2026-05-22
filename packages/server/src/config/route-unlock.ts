function parseEnvBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value.trim() === '') return defaultValue;
  const normalized = value.trim().toLowerCase().replace(/^["']|["']$/g, '');
  if (['false', '0', 'off', 'no', 'disabled'].includes(normalized)) return false;
  if (['true', '1', 'on', 'yes', 'enabled'].includes(normalized)) return true;
  return defaultValue;
}

/** 查看 AI 生成路线完整行程是否需要先支付解锁（默认 false：直接可见） */
export function isRouteUnlockPaymentRequired(): boolean {
  return parseEnvBoolean(process.env.ROUTE_UNLOCK_PAYMENT_REQUIRED, false);
}

export function getRouteUnlockConfigSummary() {
  return {
    paymentRequired: isRouteUnlockPaymentRequired(),
    rawEnv: process.env.ROUTE_UNLOCK_PAYMENT_REQUIRED ?? null,
  };
}
