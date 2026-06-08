/** 是否为开发构建（本地 dev） */
export function isDevelopmentBuild(): boolean {
  return import.meta.env.MODE === 'development';
}

/** 是否展示体验账号、开发验证码提示等仅开发期 UI */
export function isDevelopmentExperienceEnabled(): boolean {
  return isDevelopmentBuild();
}
