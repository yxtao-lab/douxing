import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
import { fileURLToPath, URL } from 'node:url';
import { API_PROXY_TARGET, DEV_PORTS } from '../../scripts/dev-ports.mjs';

const uniPlatform = process.env.UNI_PLATFORM ?? '';
const isProduction = process.env.NODE_ENV === 'production';
/** H5 与 App 并行 dev 时避免端口冲突 */
const devServerPort = uniPlatform.startsWith('app') ? DEV_PORTS.app : DEV_PORTS.mobile;

export default defineConfig({
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [uni()],
  build: {
    // 微信小程序运行环境不支持 ?? / ?. 等 ES2020 语法，须降级
    target: 'es2015',
  },
  esbuild: {
    // dev 须保留 import.meta.hot（Vite HMR）；生产构建再降级以兼容小程序
    target: isProduction ? 'es2015' : 'es2020',
  },
  resolve: {
    alias: {
      '@douxing/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
      // 使用含消息编译器的完整构建，避免占位符原样输出
      'vue-i18n': 'vue-i18n/dist/vue-i18n.esm-bundler.js',
    },
  },
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  server: {
    host: true,
    port: devServerPort,
    strictPort: true,
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
      '/uploads': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
});
