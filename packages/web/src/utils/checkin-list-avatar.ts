import type { CheckInInfo } from '@douxing/shared';

const PLACEHOLDER_GRADIENTS: readonly [string, string][] = [
  ['#1677ff', '#69b1ff'],
  ['#13c2c2', '#5cdbd3'],
  ['#722ed1', '#b37feb'],
  ['#eb2f96', '#ff85c0'],
  ['#fa8c16', '#ffc069'],
  ['#52c41a', '#95de64'],
  ['#2f54eb', '#85a5ff'],
  ['#08979c', '#36cfc9'],
];

function pickGradientSeed(item: CheckInInfo) {
  const key = `${item.id}:${item.cityCode}:${item.location.placeName ?? ''}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getCheckInPlaceholderLabel(item: CheckInInfo) {
  const source = item.location.placeName?.trim() || item.city?.trim() || item.cityCode?.trim();
  if (!source) return '?';

  const firstChar = [...source][0];
  if (!firstChar) return '?';

  return /[a-z]/i.test(firstChar) ? firstChar.toUpperCase() : firstChar;
}

export function getCheckInPlaceholderStyle(item: CheckInInfo) {
  const [from, to] = PLACEHOLDER_GRADIENTS[pickGradientSeed(item) % PLACEHOLDER_GRADIENTS.length];
  return {
    background: `linear-gradient(145deg, ${from} 0%, ${to} 100%)`,
  };
}
