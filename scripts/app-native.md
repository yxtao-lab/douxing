# iOS / Android 原生 App 部署指南

> 命令默认写 `pnpm`；仅用 npm 时改为 `npm run`（带参数脚本加 `--`）。见 [docs/包管理与命令.md](../docs/包管理与命令.md)。

兜行移动端基于 **UniApp**，原生 App 采用「CLI 编译资源 + HBuilderX 云打包/真机运行」流程。

## 一键部署

```bash
# 仅构建 Android + iOS App 资源
pnpm deploy:app

# 含 MySQL 迁移 + 后端依赖安装
pnpm deploy:app:full

# 构建后启动 API + 原生开发（默认 Android，可改平台）
pnpm deploy:app:dev

# 只构建 Android
pnpm deploy:app -- --platform android

# 只构建 iOS
pnpm deploy:app -- --platform ios
```

产物目录：

| 平台 | 路径 |
|------|------|
| 通用 App 工程（Android / iOS 共用） | `packages/mobile/dist/build/app` |
| 部署摘要 | `packages/mobile/dist/release/deploy-summary.json` |

## 单独运行某一平台（开发）

```bash
# 仅后端
pnpm dev:only server

# 仅 Web 管理端
pnpm dev:only web

# 仅 H5
pnpm dev:only mobile

# 仅微信小程序编译
pnpm dev:only mp-weixin

# 仅 Android App 开发（自动带上 server）
pnpm dev:only app-android

# 仅 iOS App 开发（需 macOS）
pnpm dev:only app-ios

# 组合
pnpm dev:only server,web,mobile
```

等价命令：

```bash
pnpm dev:app-android
pnpm dev:app-ios
```

## 单独构建

```bash
pnpm build:app-android
pnpm build:app-ios
pnpm build:app-all

# 任意组合
pnpm build:only server,web
pnpm build:only app-android,app-ios
```

## HBuilderX 打包上架

1. 安装 [HBuilderX](https://www.dcloud.io/hbuilderx.html)
2. 菜单 **文件 → 导入 → 从本地目录导入**  
   选择：`packages/mobile/dist/build/app`
3. **运行 → 运行到手机或模拟器**（需自定义调试基座）
4. **发行 → 原生 App-云打包**  
   - Android：生成 apk/aab  
   - iOS：需 Apple 开发者证书（仅 macOS 可本地打包）

## API 地址（真机必读）

`.env` 中 `VITE_API_BASE_URL` 在真机上不能使用 `localhost`。

```env
# 开发：电脑局域网 IP
VITE_API_BASE_URL=http://192.168.1.100:3000/api

# 生产：HTTPS 域名
VITE_API_BASE_URL=https://api.example.com/api
```

修改后需重新执行 `pnpm build:app-all` 或 `pnpm deploy:app`。

## 环境要求

| 目标 | 要求 |
|------|------|
| CLI 编译 | Node 18+、pnpm（本项目已满足） |
| Android 真机/模拟器 | HBuilderX、Android Studio（可选） |
| iOS 真机/模拟器 | macOS、Xcode、Apple 开发者账号 |
| 云打包 | DCloud 账号 |

## 平台标识一览

见 `scripts/platforms.mjs`，常用：`server` `web` `mobile` `mp-weixin` `app-android` `app-ios`。
