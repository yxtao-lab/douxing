import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { i18n } from './i18n';
import { bootstrapSession, setupHttpAuthHandlers } from './utils/session';
import 'ant-design-vue/dist/reset.css';
import './styles/main.css';
import './styles/admin-page.css';

async function bootstrap() {
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);
  app.use(i18n);
  app.use(router);

  setupHttpAuthHandlers(router);
  await bootstrapSession();
  app.mount('#app');
}

bootstrap();
