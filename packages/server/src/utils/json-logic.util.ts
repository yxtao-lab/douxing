/**
 * W3-2 · 轻量 JSON Logic 求值（模板选择用，无第三方依赖）。
 */

type JsonLogicValue = unknown;

/**
 * 对 JSON Logic 表达式求值。
 *
 * @param rule - JSON Logic 规则或布尔字面量
 * @param data - 变量上下文（`var` 从此读取）
 * @returns 规则是否为真
 */
export function evaluateJsonLogic(rule: JsonLogicValue, data: Record<string, unknown>): boolean {
  if (rule === true) return true;
  if (rule === false) return false;
  if (rule == null) return false;
  if (typeof rule !== 'object' || Array.isArray(rule)) {
    return Boolean(rule);
  }

  const entries = Object.entries(rule as Record<string, JsonLogicValue>);
  if (entries.length !== 1) return false;

  const [op, rawArgs] = entries[0]!;
  const args = Array.isArray(rawArgs) ? rawArgs : [rawArgs];

  switch (op) {
    case 'var': {
      const key = args[0];
      if (typeof key !== 'string') return false;
      const fallback = args.length > 1 ? args[1] : null;
      const value = data[key];
      return value !== undefined && value !== null ? Boolean(value) : Boolean(fallback);
    }
    case '==':
      return resolveJsonLogicValue(args[0], data) === resolveJsonLogicValue(args[1], data);
    case '!=':
      return resolveJsonLogicValue(args[0], data) !== resolveJsonLogicValue(args[1], data);
    case '<':
      return compareJsonLogic(args[0], args[1], data, (a, b) => a < b);
    case '<=':
      return compareJsonLogic(args[0], args[1], data, (a, b) => a <= b);
    case '>':
      return compareJsonLogic(args[0], args[1], data, (a, b) => a > b);
    case '>=':
      return compareJsonLogic(args[0], args[1], data, (a, b) => a >= b);
    case 'and':
      return args.every((item) => evaluateJsonLogic(item, data));
    case 'or':
      return args.some((item) => evaluateJsonLogic(item, data));
    case '!':
      return !evaluateJsonLogic(args[0], data);
    case 'in': {
      const needle = resolveJsonLogicValue(args[0], data);
      const haystack = resolveJsonLogicValue(args[1], data);
      return Array.isArray(haystack) && haystack.includes(needle);
    }
    default:
      return false;
  }
}

/**
 * 解析 JSON Logic 操作数（字面量或 var 引用）。
 *
 * @param operand - 操作数表达式
 * @param data - 变量上下文
 * @returns 解析后的 JavaScript 值
 */
export function resolveJsonLogicValue(
  operand: JsonLogicValue,
  data: Record<string, unknown>,
): unknown {
  if (operand === true || operand === false || operand == null) return operand;
  if (typeof operand === 'number' || typeof operand === 'string') return operand;
  if (typeof operand !== 'object' || Array.isArray(operand)) return operand;

  const entries = Object.entries(operand as Record<string, JsonLogicValue>);
  if (entries.length === 1 && entries[0]![0] === 'var') {
    const key = entries[0]![1];
    if (Array.isArray(key)) {
      const name = key[0];
      if (typeof name !== 'string') return null;
      const fallback = key.length > 1 ? key[1] : null;
      return data[name] ?? fallback ?? null;
    }
    if (typeof key === 'string') {
      return data[key] ?? null;
    }
    return null;
  }

  return operand;
}

/**
 * 对两个操作数做数值比较。
 *
 * @param left - 左操作数
 * @param right - 右操作数
 * @param data - 变量上下文
 * @param compare - 比较函数
 * @returns 比较结果；非数字时返回 false
 */
function compareJsonLogic(
  left: JsonLogicValue,
  right: JsonLogicValue,
  data: Record<string, unknown>,
  compare: (a: number, b: number) => boolean,
): boolean {
  const a = resolveJsonLogicValue(left, data);
  const b = resolveJsonLogicValue(right, data);
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return compare(a, b);
}
