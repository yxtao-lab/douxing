import type { LocaleCode } from './i18n/types.js';
import { DEFAULT_LOCALE } from './i18n/constants.js';
import { formatSceneTagLabel, isSceneTagSlug } from './i18n/scene-tags.js';
import {
  formatAgeRangeLabel,
  formatBudgetTierLabel,
  formatCompanionStructureLabel,
  formatTravelRadiusLabel,
  isAgeRangeSlug,
  isBudgetTierSlug,
  isTravelRadiusSlug,
} from './i18n/profile-tags.js';
import { formatInterestTagLabel } from './i18n/interest-tags.js';

/** 构建场景定制规划 prompt 时使用的用户画像字段（可选） */
export interface ScenePlanUserProfileInput {
  interestTags?: string[] | null;
  preferredScenes?: string[] | null;
  ageRange?: string | null;
  travelRadius?: string | null;
  companionStructure?: string[] | null;
  budgetTier?: string | null;
}

/**
 * 根据场景标签与用户画像拼装定制规划首条 prompt。
 * 广场该场景无公开路线时，用此文案跳转 AI 规划页生成专属行程。
 *
 * @param sceneSlug - 场景标签 slug（如 kids / date）
 * @param profile - 用户画像；未登录或字段缺失时仅用场景约束
 * @param locale - 界面语言，影响文案语言
 * @returns 可直接作为规划会话首条用户消息的自然语言
 */
export function buildSceneCustomPlanPrompt(
  sceneSlug: string,
  profile?: ScenePlanUserProfileInput | null,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  const slug = isSceneTagSlug(sceneSlug) ? sceneSlug : sceneSlug.trim();
  const sceneLabel = isSceneTagSlug(slug)
    ? formatSceneTagLabel(slug, locale)
    : slug || (locale === 'en-US' ? 'this scene' : '该场景');

  const parts: string[] = [];
  if (locale === 'en-US') {
    parts.push(
      `Please plan a customized trip for the 「${sceneLabel}」 scene.`,
      'Prefer public POIs matching this scene when available.',
    );
  } else {
    parts.push(
      `请为我定制一套「${sceneLabel}」场景的旅行路线。`,
      '优先参考该场景相关的公开景点与玩法。',
    );
  }

  const profileBits: string[] = [];
  if (profile?.companionStructure?.length) {
    const labels = profile.companionStructure
      .map((item) => formatCompanionStructureLabel(item, locale))
      .filter(Boolean);
    if (labels.length) {
      profileBits.push(
        locale === 'en-US'
          ? `Companions: ${labels.join(', ')}`
          : `同伴：${labels.join('、')}`,
      );
    }
  }
  if (profile?.budgetTier && isBudgetTierSlug(profile.budgetTier)) {
    profileBits.push(
      locale === 'en-US'
        ? `Budget: ${formatBudgetTierLabel(profile.budgetTier, locale)}`
        : `预算：${formatBudgetTierLabel(profile.budgetTier, locale)}`,
    );
  }
  if (profile?.travelRadius && isTravelRadiusSlug(profile.travelRadius)) {
    profileBits.push(
      locale === 'en-US'
        ? `Radius: ${formatTravelRadiusLabel(profile.travelRadius, locale)}`
        : `出行范围：${formatTravelRadiusLabel(profile.travelRadius, locale)}`,
    );
  }
  if (profile?.ageRange && isAgeRangeSlug(profile.ageRange)) {
    profileBits.push(
      locale === 'en-US'
        ? `Age range: ${formatAgeRangeLabel(profile.ageRange, locale)}`
        : `年龄段：${formatAgeRangeLabel(profile.ageRange, locale)}`,
    );
  }
  if (profile?.interestTags?.length) {
    const labels = profile.interestTags
      .slice(0, 6)
      .map((tag) => formatInterestTagLabel(tag, locale));
    profileBits.push(
      locale === 'en-US'
        ? `Interests: ${labels.join(', ')}`
        : `兴趣：${labels.join('、')}`,
    );
  }

  if (profileBits.length) {
    parts.push(
      locale === 'en-US'
        ? `My preferences: ${profileBits.join('; ')}.`
        : `我的偏好：${profileBits.join('；')}。`,
    );
  } else {
    parts.push(
      locale === 'en-US'
        ? 'I have not filled more preferences; suggest a practical 1–3 day plan.'
        : '我暂未填写更多偏好，请给出可执行的 1～3 日行程建议。',
    );
  }

  parts.push(
    locale === 'en-US'
      ? 'Please generate an executable itinerary I can refine later.'
      : '请生成可执行的行程方案，后续我可能再追问调整。',
  );

  return parts.join(' ');
}
