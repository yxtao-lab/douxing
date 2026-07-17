# -*- coding: utf-8 -*-
"""第一册 游客分册（C 端用户 · 移动端 / PC 用户端）。"""
from manual_lib import *


def build(doc):
    """构建第一册游客分册并写入 doc。"""
    section_title(doc, '第一册')
    section_subtitle(doc, '游客分册 · C 端用户')
    section_subtitle(doc, '移动端 / PC 用户端')
    page_break(doc)

    # 第 1 章 注册与登录
    add_heading(doc, '第 1 章  注册与登录', level=1)
    add_para(doc, '游客通过移动端或 PC 用户端注册账号并登录后，方可使用 AI 规划、打卡、相册等个性化功能。两端账号体系互通，登录态通过双 Token（Access + Refresh）无感刷新维持。')

    add_heading(doc, '1.1 登录界面', level=2)
    add_para(doc, 'PC 用户端登录页采用左品牌右表单的双栏布局；移动端登录页为单栏卡片式。均支持「验证码登录」与「密码登录」两种方式。')
    add_image(doc, PC, '01-login.png', '图 1-1  PC 用户端登录页')
    add_image(doc, MOBILE, '01-login.png', '图 1-2  移动端登录页（移动视口）')

    add_heading(doc, '1.2 功能点', level=2)
    add_bullet(doc, '验证码登录：输入手机号 → 获取验证码（开发环境固定 1234）→ 输入验证码 → 登录。')
    add_bullet(doc, '密码登录：输入用户名 + 密码 → 登录；首次无账号可点击「去注册」。')
    add_bullet(doc, '语言切换：登录页右上角可切换简体中文 / English。')
    add_bullet(doc, '双 Token 无感刷新：Access Token 过期后自动用 Refresh Token 续期，用户无感知。')

    add_heading(doc, '1.3 操作流程', level=2)
    add_number(doc, '打开兜行 PC 用户端（http://127.0.0.1:5176）或移动端 H5。')
    add_number(doc, '点击右上角「登录」或首页 CTA 进入登录页。')
    add_number(doc, '选择「密码登录」Tab，输入用户名 demo、密码 demo123（演示账号）。')
    add_number(doc, '点击「登录」按钮，成功后自动跳转至首页。')

    add_heading(doc, '1.4 首页（登录后）', level=2)
    add_para(doc, '登录后首页顶部导航显示「首页 / 智能规划 / 我的路线 / 我的」，右上角显示用户昵称与「退出登录」按钮。Hero 区展示品牌主张与「开始规划」CTA，下方为「热门路线」卡片网格。')
    add_image(doc, PC, '02-home.png', '图 1-3  PC 用户端首页（登录后）')
    add_image(doc, MOBILE, '02-home.png', '图 1-4  移动端首页（登录后）')
    page_break(doc)

    # 第 2 章 AI 智能规划
    add_heading(doc, '第 2 章  AI 智能规划', level=1)
    add_para(doc, 'AI 智能规划是兜行的核心主链入口：用户用一句话描述需求（如「杭州 3 天亲子游」），系统经意图解析、RAG 景点检索、多方案生成、多轮对话追问、后端 Enricher 增强（交通/住宿/班次/玩法），最终输出可执行的候选路线。')

    add_heading(doc, '2.1 规划界面', level=2)
    add_para(doc, '规划页提供对话式输入框与历史会话列表。用户可输入自然语言需求，AI 返回 2~3 套候选方案，支持多轮追问优化。')
    add_image(doc, PC, '03-plan.png', '图 2-1  PC 用户端 AI 规划页')
    add_image(doc, MOBILE, '03-plan.png', '图 2-2  移动端 AI 规划页')

    add_heading(doc, '2.2 功能点', level=2)
    add_bullet(doc, '一句话需求输入：支持城市、天数、预算、主题、人群等自然语言表达。')
    add_bullet(doc, '多方案候选：AI 一次生成 2~3 套路线供对比选择。')
    add_bullet(doc, '多轮追问：可继续追问「再便宜点」「加一天」「换成亲子」等收敛方案。')
    add_bullet(doc, 'Enricher 增强：自动补全交通方式、住宿建议、班次时刻、玩法推荐。')
    add_bullet(doc, '会话历史：左侧/顶部保留历史规划会话，可随时回看。')

    add_heading(doc, '2.3 操作流程', level=2)
    add_number(doc, '登录后点击导航「智能规划」或首页「开始规划」CTA。')
    add_number(doc, '在输入框输入需求，例如「杭州 3 天亲子游，预算 5000，休闲为主」。')
    add_number(doc, '点击发送，等待 AI 返回候选方案（通常 10~30 秒）。')
    add_number(doc, '在候选方案中选择一套，可继续追问优化或直接保存为我的路线。')
    add_number(doc, '保存后可在「我的路线」查看完整行程。')
    add_note(doc, 'AI 模型默认 auto 模式：优先兜行微调模型，失败降级 DeepSeek，再降级 LM Studio，最后模板兜底。')
    page_break(doc)

    # 第 3 章 我的路线
    add_heading(doc, '第 3 章  我的路线', level=1)
    add_para(doc, '「我的路线」展示用户保存的所有路线（含 AI 生成、手动创建、解锁的公开路线），按时间倒序排列，支持筛选、查看详情、分享与解锁。')

    add_heading(doc, '3.1 路线列表', level=2)
    add_image(doc, PC, '04-routes.png', '图 3-1  PC 用户端我的路线列表')
    add_image(doc, MOBILE, '04-routes-list.png', '图 3-2  移动端我的路线列表')

    add_heading(doc, '3.2 路线详情', level=2)
    add_para(doc, '路线详情页展示封面、概要、按天行程、每日 POI（景点/餐饮/住宿）、交通方式、地图轨迹（Polyline）。未解锁路线仅展示前 1~2 天，完整行程需解锁订单支付后查看。')
    add_image(doc, PC, '05-route-detail.png', '图 3-3  PC 用户端路线详情')
    add_image(doc, MOBILE, '05-route-detail.png', '图 3-4  移动端路线详情')

    add_heading(doc, '3.3 功能点', level=2)
    add_bullet(doc, '路线卡片：封面图、标题、天数、点赞数、浏览数。')
    add_bullet(doc, '按天行程：每日 POI 列表含景点介绍、停留时长、交通衔接。')
    add_bullet(doc, '地图轨迹：Leaflet（PC）/ UniApp map（移动端）展示路线 Polyline。')
    add_bullet(doc, '解锁完整行程：付费解锁后查看全部天数与详细玩法。')
    add_bullet(doc, '分享：生成手帐海报 / 分享链接，可分享到站外。')

    add_heading(doc, '3.4 操作流程（解锁路线）', level=2)
    add_number(doc, '在「我的路线」点击任一路线进入详情。')
    add_number(doc, '浏览免费展示的天数，点击「解锁完整行程」按钮。')
    add_number(doc, '在订单确认页选择支付方式（模拟支付 / 微信支付）。')
    add_number(doc, '完成支付后返回路线详情，全部天数与玩法解锁。')
    add_number(doc, '可在「我的订单」查看解锁订单记录。')
    page_break(doc)

    # 第 4 章 打卡
    add_heading(doc, '第 4 章  打卡', level=1)
    add_para(doc, '到达景点后通过 GPS 围栏打卡，自动触发成就与徽章解锁，并归并进对应路线的旅程相册。打卡数据汇入排行榜与打卡地图。')

    add_heading(doc, '4.1 打卡记录列表', level=2)
    add_image(doc, PC, '14-checkins.png', '图 4-1  PC 用户端打卡记录')
    add_image(doc, MOBILE, '14-checkins-list.png', '图 4-2  移动端打卡记录')

    add_heading(doc, '4.2 打卡地图', level=2)
    add_para(doc, '打卡地图聚合展示用户所有打卡点，PC 端用 Leaflet + 高德瓦片，移动端用 UniApp map。支持城市/路线筛选与聚合缩放。')
    add_image(doc, PC, '15-checkins-map.png', '图 4-3  PC 用户端打卡地图')
    add_image(doc, MOBILE, '15-checkins-map.png', '图 4-4  移动端打卡地图')

    add_heading(doc, '4.3 功能点', level=2)
    add_bullet(doc, 'GPS 围栏打卡：到达景点围栏范围内方可打卡，含 attractionId。')
    add_bullet(doc, '照片打卡：可选上传现场照片，自动归并进旅程相册。')
    add_bullet(doc, '自动触发：打卡成功后自动判定成就（8 种）与徽章（11 种）解锁。')
    add_bullet(doc, '地图聚合：按城市/路线筛选，缩放级别自动聚合点位。')

    add_heading(doc, '4.4 操作流程', level=2)
    add_number(doc, '到达景点后打开「打卡地图」或景点详情页。')
    add_number(doc, '点击「打卡」按钮，系统校验 GPS 围栏。')
    add_number(doc, '可选拍摄/上传现场照片。')
    add_number(doc, '提交后查看解锁的成就/徽章动画。')
    add_number(doc, '在「打卡记录」回看历史打卡。')
    page_break(doc)

    # 第 5 章 成就徽章排行榜
    add_heading(doc, '第 5 章  成就、徽章与排行榜', level=1)
    add_heading(doc, '5.1 我的成就', level=2)
    add_para(doc, '成就系统共 8 种（配置化），如「首次打卡」「连续打卡 7 天」「打卡 10 个城市」等，打卡后自动判定解锁。')
    add_image(doc, PC, '12-achievements.png', '图 5-1  PC 用户端我的成就')
    add_image(doc, MOBILE, '12-achievements.png', '图 5-2  移动端我的成就')

    add_heading(doc, '5.2 我的徽章', level=2)
    add_para(doc, '徽章系统共 11 种，含进度型徽章（如「打卡 100 个景点」按进度推进），解锁后在徽章墙展示。')
    add_image(doc, PC, '13-badges.png', '图 5-3  PC 用户端我的徽章')
    add_image(doc, MOBILE, '13-badges.png', '图 5-4  移动端我的徽章')

    add_heading(doc, '5.3 排行榜', level=2)
    add_para(doc, '排行榜按打卡数/积分排名，分周榜与月榜，激励用户持续探索。')
    add_image(doc, PC, '16-leaderboard.png', '图 5-5  PC 用户端排行榜')
    add_image(doc, MOBILE, '16-leaderboard.png', '图 5-6  移动端排行榜')

    add_heading(doc, '5.4 功能点', level=2)
    add_bullet(doc, '成就/徽章自动解锁：打卡或行为触发，无需手动领取。')
    add_bullet(doc, '进度型徽章：展示当前进度与目标，如 32/100。')
    add_bullet(doc, '排行榜周期：周榜（自然周）/ 月榜（自然月），自动刷新。')
    add_bullet(doc, '排名激励：Top 用户在榜单高亮，刺激社交分享。')
    page_break(doc)

    # 第 6 章 旅程相册
    add_heading(doc, '第 6 章  旅程相册', level=1)
    add_para(doc, '旅程相册按路线归集旅行照片（含打卡照片与手动上传），支持按天/POI 浏览、EXIF 解析、手帐选图与分享。会员有存储配额。')
    add_heading(doc, '6.1 相册列表', level=2)
    add_image(doc, PC, '10-journey-albums.png', '图 6-1  PC 用户端旅程相册列表')
    add_image(doc, MOBILE, '10-journey-albums.png', '图 6-2  移动端旅程相册列表')

    add_heading(doc, '6.2 相册详情', level=2)
    add_para(doc, '相册详情按天/POI 分组展示照片，可上传、删除、选图生成手帐海报、生成分享链接。')
    add_image(doc, PC, '11-journey-album-detail.png', '图 6-3  PC 用户端相册详情')
    add_image(doc, MOBILE, '11-journey-album-detail.png', '图 6-4  移动端相册详情')

    add_heading(doc, '6.3 功能点', level=2)
    add_bullet(doc, '按路线归集：每条路线一个相册，打卡照片自动归并。')
    add_bullet(doc, '按天/POI 分组：照片按行程天与景点聚合展示。')
    add_bullet(doc, 'EXIF 解析：读取拍摄时间、GPS，自动归位到对应 POI。')
    add_bullet(doc, '手帐选图：从相册选图进入手帐海报模板渲染。')
    add_bullet(doc, '会员配额：不同会员等级有不同存储配额，超额提示升级。')
    page_break(doc)

    # 第 7 章 个人中心
    add_heading(doc, '第 7 章  个人中心', level=1)
    add_para(doc, '个人中心聚合用户资料、会员权益、AI 旅行宠物记忆墙、订单等入口。')
    add_heading(doc, '7.1 个人主页', level=2)
    add_image(doc, PC, '06-profile.png', '图 7-1  PC 用户端个人主页')
    add_image(doc, MOBILE, '06-profile.png', '图 7-2  移动端个人主页')

    add_heading(doc, '7.2 编辑资料', level=2)
    add_image(doc, PC, '07-profile-edit.png', '图 7-3  PC 用户端编辑资料')
    add_image(doc, MOBILE, '07-profile-edit.png', '图 7-4  移动端编辑资料')

    add_heading(doc, '7.3 会员权益', level=2)
    add_para(doc, '会员页展示当前等级、权益对比、套餐升级入口。会员等级影响路线解锁折扣、相册配额、AI 规划次数等。')
    add_image(doc, PC, '08-membership.png', '图 7-5  PC 用户端会员权益')
    add_image(doc, MOBILE, '08-membership.png', '图 7-6  移动端会员权益')

    add_heading(doc, '7.4 AI 旅行宠物记忆墙', level=2)
    add_para(doc, 'AI 旅行宠物记录用户旅行记忆，提供 AI 分析与全站悬浮陪伴。记忆墙展示宠物成长与旅行回忆。')
    add_image(doc, PC, '09-pet-memories.png', '图 7-7  PC 用户端记忆墙')
    add_image(doc, MOBILE, '09-pet-memories.png', '图 7-8  移动端记忆墙')

    add_heading(doc, '7.5 功能点', level=2)
    add_bullet(doc, '资料编辑：头像、昵称、签名、兴趣标签（数据库存中文预设值，展示用标签 Label）。')
    add_bullet(doc, '会员升级：选择套餐 → 支付 → 升级等级，享受对应权益。')
    add_bullet(doc, 'AI 宠物：领养后悬浮全站，记忆墙回看旅行记忆与 AI 分析。')
    add_bullet(doc, '我的订单：查看路线解锁、会员升级等订单记录。')
    page_break(doc)

    # 第 8 章 我的订单
    add_heading(doc, '第 8 章  我的订单', level=1)
    add_para(doc, '「我的订单」展示路线解锁、会员升级等模块 A 商业订单。模块 B 发单接单的服务订单在商户工作台查看。')
    add_image(doc, PC, '17-orders.png', '图 8-1  PC 用户端我的订单')
    add_image(doc, MOBILE, '17-orders-list.png', '图 8-2  移动端我的订单')
    add_heading(doc, '8.1 功能点', level=2)
    add_bullet(doc, '订单列表：按时间倒序，含订单号、类型、金额、状态、创建时间。')
    add_bullet(doc, '订单状态：待支付 / 已支付 / 已取消 / 已退款。')
    add_bullet(doc, '支付方式：模拟支付（开发）/ 微信支付（生产）。')
    add_bullet(doc, '时间展示：统一 yyyy-mm-dd HH:mm:ss（东八区）。')
    page_break(doc)
