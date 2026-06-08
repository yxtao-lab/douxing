import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { i18n } from './i18n';
import { bootstrapSession, setupHttpAuthHandlers } from './utils/session';
import './styles/main.css';

async function bootstrap() {
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);
  app.use(i18n);
  app.use(router);

  await bootstrapSession();
  setupHttpAuthHandlers(router);
  app.mount('#app');
}

bootstrap();
