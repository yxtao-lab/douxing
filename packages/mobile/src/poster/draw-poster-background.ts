import type { PosterCanvasContext } from './types';
import type { PosterThemePresetId } from './types';
import { POSTER_COLORS } from './draw-utils';

export interface PosterThemeVisual {
  paper: string;
  card: string;
  ink: string;
  inkMuted: string;
  accent: string;
  footer: string;
  columnBg: string;
}

export const POSTER_THEME_VISUALS: Record<PosterThemePresetId, PosterThemeVisual> = {
  forest: {
    paper: '#f0f5f0',
    card: '#fffef8',
    ink: '#1b4332',
    inkMuted: '#52796f',
    accent: '#2d6a4f',
    footer: '#1b4332',
    columnBg: '#f8fbf8',
  },
  ocean: {
    paper: '#eef4fa',
    card: '#f8fcff',
    ink: '#1d3557',
    inkMuted: '#457b9d',
    accent: '#1d3557',
    footer: '#0d1b2a',
    columnBg: '#f4f9fd',
  },
  sunset: {
    paper: '#fff8f0',
    card: '#fffaf5',
    ink: '#6a040f',
    inkMuted: '#9d0208',
    accent: '#e85d04',
    footer: '#6a040f',
    columnBg: '#fff5eb',
  },
  classic: {
    paper: '#f7f0e3',
    card: '#fff9ef',
    ink: '#2c2416',
    inkMuted: '#6b5c48',
    accent: '#6b5c48',
    footer: '#2c2416',
    columnBg: '#fffdf8',
  },
};

function drawDotPattern(
  ctx: PosterCanvasContext,
  width: number,
  height: number,
  color: string,
  spacing: number,
  radius: number,
) {
  ctx.save();
  ctx.fillStyle = color;
  for (let y = spacing; y < height; y += spacing) {
    for (let x = spacing; x < width; x += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawLinePattern(
  ctx: PosterCanvasContext,
  width: number,
  height: number,
  color: string,
  gap: number,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let y = gap; y < height; y += gap) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(width - 24, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWavePattern(ctx: PosterCanvasContext, width: number, height: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let row = 0; row < 6; row += 1) {
    const baseY = 120 + row * 140;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 12) {
      const y = baseY + Math.sin(x / 48 + row) * 18;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrossPattern(ctx: PosterCanvasContext, width: number, height: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  const step = 56;
  for (let x = 0; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.stroke();
  }
  ctx.restore();
}

/** 带主题底纹的背景（替代纯色 fillPaperBackground） */
export function fillThemedBackground(
  ctx: PosterCanvasContext,
  width: number,
  height: number,
  themePresetId: PosterThemePresetId = 'classic',
): PosterThemeVisual {
  const visual = POSTER_THEME_VISUALS[themePresetId] ?? POSTER_THEME_VISUALS.classic;

  ctx.fillStyle = visual.paper;
  ctx.fillRect(0, 0, width, height);

  switch (themePresetId) {
    case 'forest':
      drawLinePattern(ctx, width, height, 'rgba(45, 106, 79, 0.07)', 32);
      drawDotPattern(ctx, width, height, 'rgba(45, 106, 79, 0.06)', 72, 2.5);
      break;
    case 'ocean':
      drawWavePattern(ctx, width, height, 'rgba(29, 53, 87, 0.07)');
      drawDotPattern(ctx, width, height, 'rgba(69, 123, 157, 0.08)', 64, 3);
      break;
    case 'sunset':
      drawDotPattern(ctx, width, height, 'rgba(232, 93, 4, 0.07)', 48, 2);
      drawLinePattern(ctx, width, height, 'rgba(157, 2, 8, 0.05)', 40);
      break;
    default:
      drawLinePattern(ctx, width, height, 'rgba(107, 92, 72, 0.08)', 28);
      drawCrossPattern(ctx, width, height, 'rgba(107, 92, 72, 0.03)');
      break;
  }

  return visual;
}

/** 获取当前主题下的卡片/强调色（供模板读取） */
export function getThemeVisual(themePresetId: PosterThemePresetId): PosterThemeVisual {
  return POSTER_THEME_VISUALS[themePresetId] ?? POSTER_THEME_VISUALS.classic;
}

/** 将主题视觉合并进默认 POSTER_COLORS */
export function resolvePosterColors(themePresetId: PosterThemePresetId) {
  const visual = getThemeVisual(themePresetId);
  return {
    ...POSTER_COLORS,
    paper: visual.paper,
    card: visual.card,
    ink: visual.ink,
    inkMuted: visual.inkMuted,
    accent: visual.accent,
    footer: visual.footer,
    columnBg: visual.columnBg,
  };
}
