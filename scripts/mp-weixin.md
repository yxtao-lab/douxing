# 兜行 · 微信小程序部署

> 命令默认写 `pnpm`；仅用 npm 时改为 `npm run`（例：`pnpm dev:mp-weixin` → `npm run dev:mp-weixin`）。见 [docs/包管理与命令.md](../docs/包管理与命令.md)。

AppID：`wx2c8d1e2b2e502819`

海报 QR 与环境变量见 [docs/env-environments.md §8](../docs/env-environments.md#8-海报二维码配置)。

## 1. 开发调试

一键（推荐，与 `pnpm bootstrap` / `pnpm bootstrap:dev` 配套）：

```bash
pnpm dev   # API + 管理端 + H5 + 微信小程序 + Android App 编译监听
```

或分终端：

```bash
# 终端 1：启动后端
pnpm dev:server

# 终端 2：编译并监听小程序（首次编译完成后自动打开微信开发者工具）
pnpm dev:mp-weixin
```

> 自动打开需在微信开发者工具 **设置 → 安全设置** 中开启「服务端口」。
> 首次配置可执行 `pnpm setup:wechat-devtools` 自动检测 CLI 并写入 `.env.local`。
> 也可手动设置 `WECHAT_DEVTOOLS_CLI`（指向 `cli.bat`）或 `WECHAT_DEVTOOLS_PORT`（HTTP 唤起）。
> 禁用自动打开：`DOUXING_NO_OPEN=1 pnpm dev:mp-weixin`。

也可手动用 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) 导入目录：

```
packages/mobile/dist/dev/mp-weixin
```

开发阶段在开发者工具中：

- **详情 → 本地设置** → 勾选「不校验合法域名、web-view、TLS…」
- 确保 `.env` 中 `VITE_API_BASE_URL=http://127.0.0.1:3000/api`

## 2. 生产 / 测试构建

环境说明见 [docs/env-environments.md](../docs/env-environments.md)。

**生产包（正式版，连 api.yxtao.site）：**

```bash
pnpm build:mp-weixin
```

**测试包（体验版，连 api-test.yxtao.site）：**

```bash
pnpm build:mp-weixin:staging
```

产物目录均为：

```
packages/mobile/dist/build/mp-weixin
```

在微信开发者工具中导入该目录，点击 **上传**，再到 [微信公众平台](https://mp.weixin.qq.com/) 提交审核或设为体验版。

## 3. 服务器与合法域名

小程序正式环境要求：

| 配置项 | 说明 |
|--------|------|
| API 地址 | 必须为 **HTTPS** |
| 公众平台 | 开发 → 开发管理 → 服务器域名 → **request 合法域名** |
| `.env` 生产 | `VITE_API_BASE_URL=https://api.yxtao.site/api`（见 `.env.production`） |
| `.env` 测试 | `VITE_API_BASE_URL=https://api-test.yxtao.site/api`（见 `.env.staging`） |

后端需部署在已备案域名下，并配置 SSL 证书。

## 4. 常见问题

- **网络请求失败**：检查 `VITE_API_BASE_URL`、后端是否启动、域名校验是否关闭（开发）或已配置（生产）
- **登录后白屏**：确认 `pages.json` 中页面路径与跳转一致
- **AppID 不匹配**：确认 `packages/mobile/src/manifest.json` 与 `project.config.json` 中 appid 一致
