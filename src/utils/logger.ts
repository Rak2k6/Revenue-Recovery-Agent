const IS_PROD = process.env.NODE_ENV === 'production';

// Fields that must never appear in logs
const PII_FIELDS = new Set(['email', 'contact', 'phone', 'card', 'vpa', 'account_number']);

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || typeof obj !== 'object') return obj;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = PII_FIELDS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return result;
}

export const logger = {
  info(ctx: Record<string, unknown>, msg: string) {
    console.log(JSON.stringify({ level: 'info', msg, ...(redact(ctx) as Record<string, unknown>) }));
  },
  warn(ctx: Record<string, unknown>, msg: string) {
    console.warn(JSON.stringify({ level: 'warn', msg, ...(redact(ctx) as Record<string, unknown>) }));
  },
  error(ctx: Record<string, unknown>, msg: string) {
    console.error(JSON.stringify({ level: 'error', msg, ...(redact(ctx) as Record<string, unknown>) }));
  },
  // In production, skip debug logs entirely
  debug(ctx: Record<string, unknown>, msg: string) {
    if (!IS_PROD) console.log(JSON.stringify({ level: 'debug', msg, ...(redact(ctx) as Record<string, unknown>) }));
  },
};
