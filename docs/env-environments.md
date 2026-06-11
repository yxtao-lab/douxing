# 兜行 · 环境配置与打包说明

> 执行 **`pnpm env:status`** 可查看当前各环境 API 地址与配置文件状态。

---

## 1. 环境文件（整理后）

| 文件 | 提交 Git | 用途 |
|------|----------|------|
| `.env` | 否 | **后端运行时**：数据库、JWT、LLM 密钥等。**禁止写 `VITE_*`** |
| `.env.example` | 是 | 后端模板，首次 `cp .env.example .env` |
| `.env.local` | 否 | **本机专用**：局域网 API IP、微信开发者工具 CLI |
| `.env.development` | 是 | dev 共享前端项（如 `VITE_H5_BASE_URL`），不含 API 地址 |
| `.env.staging` | 是 | 测试包 API（`pnpm build:*:staging`） |
| `.env.production` | 是 | 生产包 API（`pnpm build:*`） |
| `deploy/env.*.example` | 是 | 服务器部署模板（复制为服务器上的 `.env`） |

**已删除/合并：**

- ~~`.env.development.local`~~ → 合并到 `.env.local`
- ~~`.env.development.local.example`~~ → 说明已写入 `.env.example`

---

## 2. 最简单切换环境

**按你要做的事选命令，一般不用改 env 文件：**

| 目标 | 命令 | 读取配置 |
|------|------|----------|
| **本地开发** | `pnpm dev` | `.env`（后端）+ `.env.local`（本机 API） |
| **测试打包** | `pnpm build:mp-weixin:staging` | `.env.staging` |
| **生产打包** | `pnpm build:mp-weixin` | `.env.production` |

**只有本地 dev 需要改文件时：** 编辑 `.env.local` 里的 `VITE_API_BASE_URL`：

```env
# 模拟器
VITE_API_BASE_URL=http://127.0.0.1:3000/api

# 真机（ipconfig 查电脑局域网 IP）
VITE_API_BASE_URL=http://192.168.x.x:3000/api
```

改后 **Ctrl+C 重启 `pnpm dev`**，微信开发者工具点「编译」。  
小程序导入目录：`packages/mobile/dist/dev/mp-weixin`（不是 `dist/build`）。

---

## 3. 三套 API 地址

| 环境 | 前端 API | 静态资源根（后端 `.env`） |
|------|----------|----------------------------|
| 本地 | `.env.local` 或默认 `127.0.0.1:3000` | `API_PUBLIC_BASE_URL_DVE=http://127.0.0.1:3000` |
| 测试 | `https://api-test.yxtao.site/api` | `https://api-test.yxtao.site` |
| 生产 | `https://api.yxtao.site/api` | `https://api.yxtao.site` |

> 后期品牌域（`douxingai` / `douxingtravel`）注册与迁移步骤见 [域名规划.md](./域名规划.md)。

---

## 4. 本地开发

```bash
cp .env.example .env     # 首次
pnpm dev                 # 全端 + AI + 本地 API（Web/PC 自动打开浏览器）
pnpm env:status          # 检查当前 API 是否指向本地
```

**禁用自动打开浏览器 / 微信开发者工具：** `DOUXING_NO_OPEN=1 pnpm dev`。详见 [启动与部署流程 §3.4](./启动与部署流程.md#34-浏览器自启动可选)。

---

## 5. 测试 / 生产打包

```bash
pnpm build:mp-weixin:staging   # 测试 → dist/build/mp-weixin
pnpm build:mp-weixin           # 生产 → dist/build/mp-weixin
pnpm build:web:staging
pnpm build:web
```

服务器部署模板：`deploy/env.staging.example` / `deploy/env.production.example`

---

## 6. 常见问题

**改 env 后仍连旧地址？**  
`VITE_*` 在编译时写入 JS，须重启 `pnpm dev` 或重新 `build`，并在微信开发者工具里重新编译。

**真机 uploadFile 连 127.0.0.1？**  
在 `.env.local` 改为电脑局域网 IP，或打生产/测试包。

**`.env` 里能写 `VITE_API_BASE_URL` 吗？**  
不能。会导致 dev 误连线上；API 地址只放 `.env.local`（dev）或 `.env.staging` / `.env.production`（打包）。

更多部署细节见 [启动与部署流程.md](./启动与部署流程.md)。

---

## 7. 相关文档

| 文档 | 内容 |
|------|------|
| [启动与部署流程.md](./启动与部署流程.md) | 开发 / 测试 / 生产启动与发版 |
| [../scripts/README.md](../scripts/README.md) | scripts 目录各脚本说明 |
| [../scripts/mp-weixin.md](../scripts/mp-weixin.md) | 微信小程序专项 |
