# -*- coding: utf-8 -*-
import re
from pathlib import Path

path = Path(__file__).resolve().parent.parent / 'docs' / '详细设计文档.md'
text = path.read_text(encoding='utf-8').replace('\r\n', '\n').replace('\r', '\n')

lines = text.split('\n')
out: list[str] = []
for i, line in enumerate(lines):
    if line.strip().startswith('|') and i > 0:
        prev = lines[i - 1].strip()
        if prev and not prev.startswith('|') and not prev.startswith('#'):
            if out and out[-1].strip():
                out.append('')
    if line.startswith('###') and out and out[-1].strip() and not out[-1].startswith('#'):
        out.append('')
    if line.startswith('####') and out and out[-1].strip() and not out[-1].startswith('#'):
        out.append('')
    out.append(line)

text = '\n'.join(out)

old_yaml = """```yaml
# 网关配置示例
gateway:
rate_limit:
enabled: true
default_limit: 100  # 默认每秒100请求
user_limit: 200     # 认证用户每秒200请求
circuit_breaker:
failure_threshold: 5    # 5次失败触发熔断
timeout: 3000          # 超时时间3秒
half_open_requests: 3   # 半开状态探测请求数
```"""

new_yaml = """```yaml
# 网关配置示例
gateway:
  rate_limit:
    enabled: true
    default_limit: 100
    user_limit: 200
  circuit_breaker:
    failure_threshold: 5
    timeout: 3000
    half_open_requests: 3
```"""

text = text.replace(old_yaml, new_yaml)

summary_old = """### 核心优势
1. **技术驱动**：AI+LBS核心技术构建竞争壁垒
- 多Agent协作架构"""

summary_new = """### 核心优势

1. **技术驱动**：AI + LBS 核心技术构建竞争壁垒
   - 多 Agent 协作架构"""

text = re.sub(
    r'### 核心优势\n\n1\. \*\*技术驱动\*\*.*?### 发展建议',
    """### 核心优势

1. **技术驱动**：AI + LBS 核心技术构建竞争壁垒
   - 多 Agent 协作架构
   - 深度学习推荐算法
   - AR/VR 沉浸式体验
2. **模式创新**：游戏化社交 + 商业闭环的独特模式
   - 打卡地图与成就系统
   - 盲盒旅行创新体验
   - CPS 分佣生态
3. **完整生态**：从规划到消费的一站式服务
   - AI 智能规划
   - 社交互动
   - 商业闭环
4. **技术前瞻性**：集成 Web3、大模型等前沿技术
   - 数字藏品 NFT
   - 生成式 AI 应用
   - 隐私计算

### 发展建议""",
    text,
    flags=re.DOTALL,
)

# 修复目录（去除断行）
def slugify(title: str) -> str:
    s = re.sub(r'^#+\s*', '', title).replace('**', '').strip()
    s = re.sub(r'^(\d+)\.\s*', r'\1-', s)  # "1. 引言" -> "1-引言"
    s = re.sub(r'[^\w\u4e00-\u9fff\-/]', '', s.replace(' ', '-').lower())
    return s

chapters = re.findall(r'^## (\d+\.\s.+)$', text, re.MULTILINE)
if chapters:
    toc_lines = ['## 目录', '']
    for ch in chapters:
        slug = slugify(ch)
        toc_lines.append(f'- [{ch}](#{slug})')
    toc_lines.append('')
    toc_lines.append('---')
    toc_lines.append('')
    new_toc = '\n'.join(toc_lines)
    text = re.sub(r'## 目录\n.*?\n---\n', new_toc + '\n', text, count=1, flags=re.DOTALL)

# 去掉重复附录
parts = text.split('## 附录')
text = parts[0].rstrip()
if len(parts) > 1:
    text += """

---

## 附录

| 文档 | 说明 |
|------|------|
| [ROADMAP.md](./ROADMAP.md) | 功能实施路线图（对照本文档） |
| [README.md](../README.md) | 项目快速开始与 API 说明 |

---

<p align="center"><sub>兜行产品技术部 · V2.0 最终版 · 约 18,000 字</sub></p>
"""

path.write_text(text, encoding='utf-8', newline='\n')
print('done', path, 'lines', len(text.splitlines()))
