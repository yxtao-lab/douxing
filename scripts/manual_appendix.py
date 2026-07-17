# -*- coding: utf-8 -*-
"""附录：测试账号、访问地址与常见问题。"""
from manual_lib import *


def build(doc):
    """构建附录并写入 doc。"""
    section_title(doc, '附  录')
    section_subtitle(doc, '测试账号 · 访问地址 · 常见问题')
    page_break(doc)

    add_heading(doc, '附录 A  测试账号', level=1)
    add_para(doc, '开发环境演示账号（仅本地，勿用于生产）：')
    add_bullet(doc, '管理员：admin / admin123 —— Web 管理端全部权限。')
    add_bullet(doc, '演示用户：demo / demo123 —— C 端用户（移动端 / PC 用户端）。')
    add_bullet(doc, '商户：merchant / merchant123 —— Web 商户工作台（需 db:seed-merchant 创建）。')
    add_note(doc, '生产环境账号由平台管理员分配，禁止使用默认密码。')

    add_heading(doc, '附录 B  三端访问地址', level=1)
    add_bullet(doc, 'Web 管理端：http://127.0.0.1:5173（生产部署后为域名 /admin）。')
    add_bullet(doc, 'Web 商户工作台：http://127.0.0.1:5173/partner（或 /login?portal=partner）。')
    add_bullet(doc, 'PC 用户端：http://127.0.0.1:5176。')
    add_bullet(doc, '移动端 H5：http://127.0.0.1:5174（真机改为电脑局域网 IP）。')
    add_bullet(doc, '移动端微信小程序：pnpm dev:mp-weixin 后用微信开发者工具打开。')
    add_bullet(doc, '后端 API：http://127.0.0.1:3000/api。')
    add_bullet(doc, '运营大屏：http://127.0.0.1:5173/screen/travel。')

    add_heading(doc, '附录 C  常见问题', level=1)
    add_heading(doc, 'C.1 登录提示「用户名或密码错误」', level=2)
    add_para(doc, '检查账号是否已创建：管理员用 db:seed，商户用 db:seed-merchant，演示用户用 db:seed。生产环境管理员用 reset-admin-password 重置。')
    add_heading(doc, 'C.2 页面空白或加载失败', level=2)
    add_para(doc, '确认后端 :3000 与对应前端端口已启动（pnpm env:status 查看）。检查浏览器 Console 是否有模块导出错误，必要时重启 dev 服务。')
    add_heading(doc, 'C.3 AI 规划无响应', level=2)
    add_para(doc, '检查 AI 模型环境变量（DOUXING_LLM_* / DeepSeek / LM Studio）。默认 auto 模式会逐级降级，最终模板兜底。详见 README「AI 模型接入」章节。')
    add_heading(doc, 'C.4 打卡提示不在围栏范围', level=2)
    add_para(doc, 'GPS 定位需在景点围栏半径内。开发环境可用模拟定位；生产环境确保手机定位开启并授权。')
    add_heading(doc, 'C.5 时间显示格式不一致', level=2)
    add_para(doc, '所有用户可见时间统一 yyyy-mm-dd HH:mm:ss（东八区 Asia/Shanghai）。如发现 toLocaleString 等格式，属违规，需用 formatDisplayDateTime 修正。')
    add_heading(doc, 'C.6 国际化遗漏', level=2)
    add_para(doc, '切换 zh-CN / en-US 后若有硬编码中文/英文，需补 i18n key 到 shared/locales 与端专属 locales，后端用 ApiMessageKey。详见 docs/国际化.md。')

    add_heading(doc, '附录 D  相关文档', level=1)
    add_bullet(doc, 'docs/项目概述.md —— 项目整体架构与进度。')
    add_bullet(doc, 'docs/详细设计文档.md —— 产品完整设计。')
    add_bullet(doc, 'docs/发单接单平台.md —— 模块 B marketplace 设计。')
    add_bullet(doc, 'docs/系统管理.md —— Web 管理端 RBAC。')
    add_bullet(doc, 'docs/国际化.md —— i18n 规范。')
    add_bullet(doc, 'docs/品牌视觉规范.md —— UI 与主题。')
    add_bullet(doc, 'docs/旅行照片存储系统.md —— 旅程相册与配额。')
    add_bullet(doc, 'docs/AI路径规划路线图.md —— AI 规划主链。')

    add_heading(doc, '附录 E  截图采集说明', level=1)
    add_para(doc, '本手册截图由 scripts/capture-screenshots.mjs 自动采集，覆盖 Web 管理端、商户工作台、运营大屏、PC 用户端、移动端（PC 移动视口示意）。如需重新采集：')
    add_number(doc, '启动全端：pnpm dev（确保 MySQL :3307、Redis :6379、后端 :3000、Web :5173、PC :5176、Mobile :5174 运行）。')
    add_number(doc, '创建商户演示账号：pnpm --filter @douxing/server db:seed-merchant。')
    add_number(doc, '执行采集：node scripts/capture-screenshots.mjs。')
    add_number(doc, '重新生成手册：python scripts/build-operation-manual.py。')
    add_note(doc, '移动端 UniApp H5 在部分 dev 环境存在 vite 模块导出问题，移动端截图改用 PC 用户端移动视口（375x812）示意，功能与移动端完全对齐。')
