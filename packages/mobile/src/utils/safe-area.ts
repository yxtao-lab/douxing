/** 状态栏高度（px），custom 导航栏页顶留白用 */
export function getStatusBarHeightPx(): number {
  try {
    const info = uni.getSystemInfoSync();
    const height = info.statusBarHeight;
    return typeof height === 'number' && height > 0 ? height : 0;
  } catch {
    return 0;
  }
}

/** 状态栏 + 额外 rpx 转 px 的 padding-top 值（px 字符串） */
export function buildSafeTopPadding(extraRpx = 24): string {
  const basePx = typeof uni.upx2px === 'function' ? uni.upx2px(extraRpx) : extraRpx / 2;
  let barPx = getStatusBarHeightPx();
  if (barPx <= 0) {
    barPx = 20;
  }
  return `${barPx + basePx}px`;
}

/**
 * custom 导航栏页顶留白：优先对齐微信胶囊底部，避免内容与系统按钮区重叠
 */
export function buildCustomNavTopPadding(extraRpx = 32): string {
  const extraPx = typeof uni.upx2px === 'function' ? uni.upx2px(extraRpx) : extraRpx / 2;
  try {
    if (typeof uni.getMenuButtonBoundingClientRect === 'function') {
      const menu = uni.getMenuButtonBoundingClientRect();
      if (menu.bottom > 0) {
        return `${menu.bottom + extraPx}px`;
      }
    }
  } catch {
    // 非小程序或未支持时走状态栏方案
  }
  // 无胶囊信息时：状态栏 + 近似导航栏高度（44px）+ 额外间距
  const barPx = getStatusBarHeightPx() || 20;
  return `${barPx + 44 + extraPx}px`;
}
