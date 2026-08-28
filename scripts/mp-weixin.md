# 兜行 · 微信小程序部署

> 命令默认写 `pnpm`；仅用 npm 时改为 `npm run`。见 [docs/包管理与命令.md](../docs/包管理与命令.md)。  
> 环境变量见 [docs/env-environments.md](../docs/env-environments.md)。执行 **`pnpm env:status`** 可查看当前 API 地址。

AppID：`wxb6bf41dd9f4da3bb`

---

## 1. 开发调试

**一键（推荐）：**

```bash
pnpm dev   # API + AI + Web + PC + H5 + 小程序 + Android App
           # Web :5173、PC :5176 就绪后自动打开浏览器；小程序自动打开开发者工具
```

**或分终端：**

```bash
pnpm dev:server      # 终端 1：后端
pnpm dev:mp-weixin   # 终端 2：小程序编译（完成后自动打开微信开发者工具）
```

**导入目录（必须是 dev，不是 build）：**

```
packages/mobile/dist/dev/mp-weixin
```

**本地 API 地址**（`.env.local`，gitignore）：

```env
# 模拟器
VITE_API_BASE_URL=http://127.0.0.1:3000/api

# 真机（ipconfig 查电脑局域网 IP）
VITE_API_BASE_URL=http://192.168.x.x:3000/api
```

> **勿在 `.env` 中写 `VITE_*`**，会导致 dev 误连线上。改 `.env.local` 后须重启 `pnpm dev` 并在开发者工具里重新编译。

**微信开发者工具：**

- **详情 → 本地设置** → 勾选「不校验合法域名、web-view、TLS…」
- 自动打开：`pnpm setup:wechat-devtools`（写入 `.env.local` 的 `WECHAT_DEVTOOLS_CLI`）
- 禁用自动打开：`DOUXING_NO_OPEN=1 pnpm dev:mp-weixin`

---

## 2. 生产 / 测试构建

| 环境 | 命令 | 读取配置 | 产物 |
|------|------|----------|------|
| 测试 | `pnpm build:mp-weixin:staging` | `.env.staging` | `dist/build/mp-weixin` |
| 生产 | `pnpm build:mp-weixin` | `.env.production` | `dist/build/mp-weixin` |

上传：微信开发者工具导入 **build** 目录 → 上传 → 公众平台审核/体验版。

---

## 3. 服务器与合法域名

| 配置项 | 说明 |
|--------|------|
| API 地址 | 正式环境须 **HTTPS** |
| 公众平台 | 开发 → 开发管理 → 服务器域名 → **request / uploadFile / downloadFile 合法域名** |
| 测试 API | `https://api-test.yxtao.site`（见 `.env.staging`） |
| 生产 API | `https://api.yxtao.site`（见 `.env.production`） |

---

## 4. 常见问题

| 现象 | 处理 |
|------|------|
| 网络请求失败 | `pnpm env:status` 查 API；确认后端已启动；开发阶段关闭域名校验 |
| 仍连线上 API | 确认导入的是 `dist/dev` 而非 `dist/build`；重启 `pnpm dev` 并重新编译 |
| 登录后白屏 | 检查 `pages.json` 页面路径 |
| AppID 不匹配 | 检查 `manifest.json` 与 `project.config.json` |

海报 QR 配置见 [env-environments.md](../docs/env-environments.md) 与 [开发记录](../docs/开发记录-重难点与亮点.md)。
