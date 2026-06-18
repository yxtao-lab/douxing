import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
import { fileURLToPath, URL } from 'node:url';

const uniPlatform = process.env.UNI_PLATFORM ?? '';
const isProduction = process.env.NODE_ENV === 'production';
/** H5 与 App 并行 dev 时避免 5174 端口冲突 */
const devServerPort = uniPlatform.startsWith('app') ? 5175 : 5174;

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
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
