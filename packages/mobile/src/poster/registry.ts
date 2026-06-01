import type {
  PosterCanvasContext,
  PosterPayload,
  PosterRenderResult,
  PosterTemplateId,
  PosterTemplateMeta,
} from './types';
import { renderTimelineColumnsPoster } from './templates/timeline-columns';
import { renderDiaryPagePoster } from './templates/diary-page';

export type PosterTemplateRenderer = (
  ctx: PosterCanvasContext,
  payload: PosterPayload,
) => PosterRenderResult;

export const POSTER_TEMPLATES: PosterTemplateMeta[] = [
  {
    id: 'timeline-columns',
    nameKey: 'routes.poster.templateTimelineName',
    descKey: 'routes.poster.templateTimelineDesc',
  },
  {
    id: 'diary-page',
    nameKey: 'routes.poster.templateDiaryName',
    descKey: 'routes.poster.templateDiaryDesc',
  },
];

const RENDERERS: Record<PosterTemplateId, PosterTemplateRenderer> = {
  'timeline-columns': renderTimelineColumnsPoster,
  'diary-page': renderDiaryPagePoster,
};

export function renderPoster(
  templateId: PosterTemplateId,
  ctx: PosterCanvasContext,
  payload: PosterPayload,
): PosterRenderResult {
  const renderer = RENDERERS[templateId];
  return renderer(ctx, payload);
}

export function getDefaultPosterTemplateId(): PosterTemplateId {
  return 'timeline-columns';
}
