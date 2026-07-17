# -*- coding: utf-8 -*-
"""
生成《兜行产品介绍》docx 文档（面向外行人，简洁推广风格）。

运行：python scripts/build-product-intro.py
输出：docs/兜行产品介绍.docx
"""

from pathlib import Path
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn


# ---------- 样式工具 ----------

def set_cn_font(run, font_name="微软雅黑", size=None, bold=None, color=None):
    run.font.name = font_name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), font_name)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    if color is not None:
        run.font.color.rgb = RGBColor(*color)


# 商务深蓝 + 金色点缀
COLOR_PRIMARY = (0x0B, 0x2A, 0x4A)   # 深海军蓝
COLOR_ACCENT = (0xB8, 0x86, 0x0B)    # 古金
COLOR_SUB = (0x2E, 0x5A, 0x88)       # 次级蓝
COLOR_TEXT = (0x33, 0x33, 0x33)


def add_cover_title(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    set_cn_font(r, font_name="微软雅黑", size=34, bold=True, color=COLOR_PRIMARY)
    p.paragraph_format.space_before = Pt(36)
    p.paragraph_format.space_after = Pt(4)
    return p


def add_cover_en(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    set_cn_font(r, font_name="Times New Roman", size=14, color=COLOR_ACCENT)
    r.font.name = "Times New Roman"
    p.paragraph_format.space_after = Pt(2)
    return p


def add_cover_subtitle(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    set_cn_font(r, size=13, color=COLOR_TEXT)
    p.paragraph_format.space_after = Pt(28)
    return p


def add_cover_slogan(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    set_cn_font(r, size=15, bold=True, color=COLOR_ACCENT)
    p.paragraph_format.space_after = Pt(40)
    return p


def add_cover_meta(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    set_cn_font(r, size=10.5, color=(0x80, 0x80, 0x80))
    p.paragraph_format.space_after = Pt(2)
    return p


def add_h1(doc, text):
    p = doc.add_paragraph()
    r = p.add_run(text)
    set_cn_font(r, size=16, bold=True, color=COLOR_PRIMARY)
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(8)
    # 左侧色条 + 底边框
    pPr = p._p.get_or_add_pPr()
    pBdr = pPr.makeelement(qn("w:pBdr"), {})
    bottom = pBdr.makeelement(qn("w:bottom"), {
        qn("w:val"): "single", qn("w:sz"): "8",
        qn("w:space"): "4", qn("w:color"): "B8860B",
    })
    pBdr.append(bottom)
    pPr.append(pBdr)
    return p


def add_h2(doc, text):
    p = doc.add_paragraph()
    r = p.add_run(text)
    set_cn_font(r, size=12.5, bold=True, color=COLOR_SUB)
    p.paragraph_format.space_before = Pt(9)
    p.paragraph_format.space_after = Pt(3)
    return p


def add_para(doc, text, bold=False, size=11):
    p = doc.add_paragraph()
    r = p.add_run(text)
    set_cn_font(r, size=size, bold=bold)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.4
    return p


def add_bullet(doc, text, size=11):
    p = doc.add_paragraph(style="List Bullet")
    r = p.add_run(text)
    set_cn_font(r, size=size)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.35
    return p


def add_kv_bullet(doc, key, value, size=11):
    p = doc.add_paragraph(style="List Bullet")
    r1 = p.add_run(f"{key}：")
    set_cn_font(r1, size=size, bold=True, color=(0x1F, 0x4E, 0x79))
    r2 = p.add_run(value)
    set_cn_font(r2, size=size)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.35
    return p


def add_hr(doc):
    p = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    pBdr = pPr.makeelement(qn("w:pBdr"), {})
    bottom = pBdr.makeelement(qn("w:bottom"), {
        qn("w:val"): "single", qn("w:sz"): "4",
        qn("w:space"): "1", qn("w:color"): "BFBFBF",
    })
    pBdr.append(bottom)
    pPr.append(pBdr)
    p.paragraph_format.space_after = Pt(6)


# ---------- 文档生成 ----------

def build():
    doc = Document()

    # 页边距
    for section in doc.sections:
        section.top_margin = Cm(2.2)
        section.bottom_margin = Cm(2.2)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

    # 默认正文样式
    normal = doc.styles["Normal"]
    normal.font.name = "微软雅黑"
    normal.font.size = Pt(11)
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "微软雅黑")

    # ===== 封面 =====
    add_cover_title(doc, "兜  行")
    add_cover_en(doc, "DOUXING · AI Travel Platform")
    add_cover_subtitle(doc, "AI 驱动的全链路旅行决策与服务平台")
    add_cover_meta(doc, "产品介绍文档")
    add_cover_meta(doc, "版本 V1.0  ·  2026 年 7 月")
    # 封面后分页
    doc.add_page_break()

    # ===== 一、产品概述 =====
    add_h1(doc, "一、产品概述")
    add_para(doc,
        "兜行（Douxing）是一款以人工智能为核心驱动力的全链路旅行平台，"
        "面向个人旅行者、团体出行组织者及旅游服务供给方，"
        "提供从“需求表达—智能规划—行中体验—内容沉淀—服务撮合”的一站式解决方案。"
    )
    add_para(doc,
        "平台以“降低旅行决策与执行成本”为使命，将传统旅游行业分散在多个 App 中的"
        "攻略、行程、打卡、相册、分享、定制、撮合等环节，整合为统一闭环，"
        "并通过 AI 实现真正的“按需生成”，而非模板套用。"
    )
    add_para(doc, "平台由两大模块构成，相互独立、按需启用：", bold=True)
    add_kv_bullet(doc, "模块 A · AI 自助游",
        "面向个人出行——智能规划、路线增强、GPS 打卡、成就体系、旅程相册、手账分享。")
    add_kv_bullet(doc, "模块 B · 发单接单",
        "面向团体与定制需求——发单方发布需求，持证服务方报价履约，平台担保结算。")

    # ===== 二、核心亮点 =====
    add_h1(doc, "二、核心亮点")
    add_h2(doc, "1. AI 真规划，而非模板套用")
    add_para(doc,
        "采用多轮对话 + 知识库检索 + 多方案生成 + 后端增强的完整管线，"
        "理解城市、天数、预算、主题等真实意图，输出可执行行程，而非关键词匹配的固定模板。")
    add_h2(doc, "2. 行程自动增强，落地可执行")
    add_para(doc,
        "AI 出方案后，后端增强管线自动补全交通、住宿、班次、玩法等细节，"
        "将“骨架路线”转化为“可落地执行”的完整行程，规避“只有景点名、不知如何抵达”的痛点。")
    add_h2(doc, "3. 行中游戏化，提升体验与粘性")
    add_para(doc,
        "GPS 地理围栏自动打卡，联动 8 种成就、11 种徽章（含进度系统）与周/月排行榜，"
        "将旅行转化为可记录、可挑战、可分享的体验旅程。")
    add_h2(doc, "4. 内容沉淀与社交传播一体化")
    add_para(doc,
        "旅程相册按天/景点自动归并照片，手账海报一键渲染生成，"
        "让每一次出行都拥有体面的“作品感”，自带传播与口碑裂变属性。")
    add_h2(doc, "5. 双边撮合，平台担保交易")
    add_para(doc,
        "发单接单模块引入资质审核、报价竞标、履约评价、分账结算机制，"
        "为需求方与持证服务方构建可信交易环境，与 AI 规划订单完全分账、互不混淆。")
    add_h2(doc, "6. 自有专属模型，多级容灾")
    add_para(doc,
        "已接入百炼专属微调模型，并具备云端—本地多模型降级与容灾能力，"
        "保障规划服务在高峰与异常场景下的持续可用。")
    add_h2(doc, "7. 三端统一，国际化开箱即用")
    add_para(doc,
        "移动端、PC 用户端、Web 管理端共享同一套类型与文案，"
        "中英文双语原生支持，主题可切换，体验一致且便于跨区域推广。")

    # ===== 三、目标用户 =====
    add_h1(doc, "三、目标用户")
    add_h2(doc, "个人旅行者")
    add_bullet(doc, "希望降低攻略与决策成本、追求个性化出行体验的用户。")
    add_bullet(doc, "热衷打卡、收集成就、记录与分享旅行内容的内容型用户。")
    add_bullet(doc, "寻求旅行搭子、关注旅友圈社交动态的群体型用户。")
    add_h2(doc, "团体出行组织者")
    add_bullet(doc, "学校班级研学、毕业旅行；企业团建；社区徒步、露营、周边游。")
    add_bullet(doc, "具备旅拍、婚拍、商业拍摄等影像服务需求的个人或团队。")
    add_h2(doc, "旅游服务供给方")
    add_bullet(doc, "旅行社、户外领队、向导、摄影工作室、摄影师、模特等持证服务方。")
    add_bullet(doc, "通过资质审核后，即可在平台接单、报价、履约、结算，沉淀评价资产。")

    # ===== 四、场景案例 =====
    add_h1(doc, "四、场景案例")
    add_para(doc,
        "以下场景帮助更直观地理解兜行的实际用途与价值。", bold=True)

    add_h2(doc, "案例一：周末自由行，告别攻略焦虑")
    add_para(doc,
        "小李周末想去成都玩 3 天，预算 2000 元，偏好美食与小众景点。"
        "传统做法是花几个晚上翻小红书、马蜂窝，自己拼凑行程，还常常排不开路线。")
    add_para(doc,
        "在兜行，他只需输入一句话，AI 即刻给出 3 套候选方案，"
        "多轮对话微调后定稿，交通、住宿、玩法一并补全。"
        "出行时手机自动打卡解锁成就，归来后照片自动归入旅程相册，"
        "一键生成手账海报发朋友圈——从决策到分享，全程不操心。")

    add_h2(doc, "案例二：公司团建，HR 不再焦头烂额")
    add_para(doc,
        "王姐负责组织 80 人公司团建，需求杂、预算卡得紧，"
        "找旅行社怕被坑、比价耗时、发票对公流程繁琐。")
    add_para(doc,
        "她在兜行发布一条团建需求，多家持证旅行社并行报价，"
        "方案、价格、评价一目了然，选定后平台担保托管资金，"
        "履约完成无异议再结算，并开具发票对公走账。"
        "全流程价格透明、交易可信，王姐省下大半精力。")

    add_h2(doc, "案例三：班级研学，安全与资质有保障")
    add_para(doc,
        "班主任张老师组织毕业研学旅行，最担心的是安全与旅行社资质，"
        "家长群意见不一，预算也卡得死。")
    add_para(doc,
        "通过兜行发单后，他筛选出资质齐全、评价优秀的旅行社报价，"
        "选定后订单进入履约跟踪，关键节点可确认；"
        "行程中学生在景点打卡留影，自动归入旅程相册，"
        "毕业旅行既安全又有完整记录，家长放心、老师省心。")

    add_h2(doc, "案例四：婚拍需求，选得放心、拍得安心")
    add_para(doc,
        "准新娘小陈想拍一套旅拍婚纱照，但不知道该找谁、怕踩坑、怕付了钱跑路。")
    add_para(doc,
        "她在兜行发布婚拍需求，多家摄影工作室报价竞标，"
        "她对比作品、套餐与历史评价后选定一家，资金由平台担保，"
        "拍摄完成且验收无误后再释放结算——选得放心、拍得安心。")

    add_h2(doc, "案例五：户外领队，稳定客源与信用沉淀")
    add_para(doc,
        "老张是有资质的户外领队，过去靠朋友圈接客，客源不稳、收款难、口碑难积累。")
    add_para(doc,
        "入驻兜行后，他在接单大厅看到大量徒步、露营需求，"
        "按自身档期抢单或报价，平台担保结算让收款不再难，"
        "每单履约评价沉淀为信用资产，评价越高、曝光越优，"
        "客源与口碑形成正向循环。")

    # ===== 五、模块 A：AI 自助游 =====
    add_h1(doc, "五、模块 A：AI 自助游")
    add_h2(doc, "1. 一句话生成行程")
    add_para(doc,
        "用户在对话框输入“想去成都玩 3 天，预算 2000，偏好美食与小众景点”，"
        "AI 即可理解意图、检索景点库、给出 2~3 套候选路线，"
        "并通过多轮对话追问优化，收敛为一份令用户满意的方案。")
    add_h2(doc, "2. 多方案对比与收藏")
    add_para(doc,
        "AI 同步输出多套候选方案，用户可横向对比行程亮点、预算与天数，"
        "支持一键收藏与二次编辑，避免“一次定稿”的决策压力。")
    add_h2(doc, "3. 路线自动增强")
    add_para(doc,
        "AI 输出方案后，后端增强管线补全交通、住宿、班次、玩法等执行细节，"
        "将“骨架”转化为“可执行行程”，确保落地无盲区。")
    add_h2(doc, "4. 兴趣标签与个性化推荐")
    add_para(doc,
        "首次使用时通过引导采集兴趣偏好（美食、人文、户外、亲子等），"
        "结合历史规划与打卡记录，持续优化景点与路线推荐，做到“越用越懂你”。")
    add_h2(doc, "5. 路线发布与广场发现")
    add_para(doc,
        "用户可将满意路线发布至公开广场，供其他旅友发现、收藏与复用，"
        "形成 UGC 路线内容池，反哺平台内容生态与搜索推荐。")
    add_h2(doc, "6. GPS 打卡 · 成就 · 排行榜")
    add_para(doc,
        "抵达景点后，手机自动识别地理围栏完成打卡，可附照片。"
        "打卡联动成就（8 种）与徽章（11 种，含进度系统）解锁，并进入周榜/月榜排名。")
    add_h2(doc, "7. 打卡地图与足迹可视化")
    add_para(doc,
        "全量打卡点在地图上聚合展示，移动端基于高德地图，"
        "PC 与 Web 端基于 Leaflet + 高德瓦片，形成可视化的“旅行足迹”。")
    add_h2(doc, "8. 旅程相册")
    add_para(doc,
        "按天、按景点自动归并旅行照片，支持上传、查看、删除，"
        "会员享有存储配额，照片保留 EXIF 信息，便于日后回忆与二次创作。")
    add_h2(doc, "9. 手账海报分享")
    add_para(doc,
        "选定模板后，系统自动将路线、照片、成就渲染为精美手账海报，"
        "可保存至相册或分享至站外，提升品牌曝光与口碑传播。")
    add_h2(doc, "10. AI 旅行宠物")
    add_para(doc,
        "每位用户可领养专属 AI 旅行伙伴，具备记忆与分析能力，"
        "全站悬浮陪伴，并在行中自动庆祝打卡与成就解锁。")
    add_h2(doc, "11. 路线解锁与会员体系")
    add_para(doc,
        "完整行程可通过路线解锁订单获取，支持模拟支付与微信支付；"
        "会员体系提供存储配额、专属模型、高级模板等权益，形成可持续内容付费闭环。")

    # ===== 六、模块 B：发单接单 =====
    add_h1(doc, "六、模块 B：发单接单")
    add_para(doc,
        "模块 B 是旅行及相关服务的双边撮合市场：发单方发布需求，"
        "服务方报价或抢单，平台担保交易与结算，构建可信的服务交易环境。")
    add_h2(doc, "1. 发单方（需求侧）")
    add_bullet(doc, "个人：定制游、旅拍、婚拍、向导聘请。")
    add_bullet(doc, "学校班级：研学、毕业旅行。")
    add_bullet(doc, "企业 / 团建：50~200 人定制团，支持发票与对公结算。")
    add_bullet(doc, "社区 / 活动组：徒步、露营、周边游。")
    add_h2(doc, "2. 接单方（供给侧）")
    add_bullet(doc, "旅行社（企业组织）：定制团、研学、地接。")
    add_bullet(doc, "户外领队 / 向导（个人，可挂靠机构）：徒步、露营带队。")
    add_bullet(doc, "摄影工作室 / 团队：旅拍、婚拍、商业拍摄整包。")
    add_bullet(doc, "摄影师 / 模特（个人）：按次接单。")
    add_h2(doc, "3. 资质审核与商户入驻")
    add_para(doc,
        "服务方须上传营业执照、经营资质、人员证书等材料，"
        "经平台审核通过后开放对应服务类目的接单权限，从源头保障需求方权益。")
    add_h2(doc, "4. 两种成交模式")
    add_para(doc,
        "需求驱动（发单）：发帖 → 报价/抢单 → 选定 → 履约，适合非标定制需求；"
        "供给驱动（标品）：商户上架套餐 → 用户直购，适合标准团期与旅拍套餐。")
    add_h2(doc, "5. 报价竞标机制")
    add_para(doc,
        "同一需求可由多家服务方并行报价，发单方横向对比价格、方案、评价后选定，"
        "形成市场化竞价，提升撮合效率与价格透明度。")
    add_h2(doc, "6. 履约跟踪与评价体系")
    add_para(doc,
        "订单生成后进入履约流程，支持进度跟踪与节点确认；"
        "完成后双方互评，评价沉淀为商户信用资产，影响后续曝光与接单权重。")
    add_h2(doc, "7. 平台担保与分账结算")
    add_para(doc,
        "资金由平台担保托管，履约完成且无异议后释放结算，"
        "与 AI 规划的“路线解锁订单”完全分账，账目清晰、互不混淆。")
    add_h2(doc, "8. 商户工作台")
    add_para(doc,
        "面向入驻商户的独立工作台，承接入驻申请、需求大厅、报价管理、"
        "卖方订单履约、财务结算、排期管理等 B 端闭环能力。")
    add_h2(doc, "9. 统一服务类目")
    add_para(doc,
        "构建统一类目树，覆盖旅行服务（团体定制、个人定制、户外、向导）、"
        "影像服务（旅拍、婚拍、商业、团队）及人才服务，支撑按类目精准撮合与运营分析。")

    # ===== 结尾 =====
    add_hr(doc)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("兜行 Douxing  ·  AI Travel Platform")
    set_cn_font(r, font_name="Times New Roman", size=11, color=(0x80, 0x80, 0x80))
    r.font.name = "Times New Roman"

    out = Path("docs/兜行产品介绍-V5.docx")
    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out)
    print(f"已生成：{out.resolve()}")


if __name__ == "__main__":
    build()
