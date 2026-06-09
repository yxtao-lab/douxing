import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context';

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#008cba',
    colorBgLayout: '#f5f7fa',
    colorBgContainer: '#ffffff',
    colorText: '#1f2937',
    colorTextSecondary: '#6b7280',
    borderRadius: 8,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  components: {
    Card: {
      borderRadiusLG: 12,
    },
  },
};
