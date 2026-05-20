# 高德地理编码接入说明

> 用于兜行服务端：为 AI/待审 POI 补全 `latitude` / `longitude`，支撑地图展示与后续 B2 地理围栏。

## 1. 开通步骤

1. 登录 [高德开放平台](https://lbs.amap.com/) → 注册开发者  
2. **应用管理** → 创建应用 → 添加 **Key**  
3. Key 类型选择 **Web 服务**（服务端调用 `restapi.amap.com`，不要用 JS API Key）  
4. 控制台为该 Key 勾选/Web 服务配额：**搜索服务**（`place/text`）、**地理编码**（`geocode/geo`）  
5. 将 Key 写入项目根目录 `.env`（勿提交 Git）

```env
AMAP_WEB_KEY=你的Web服务Key
AMAP_ENABLED=true
AMAP_GEOCODE_TIMEOUT_MS=8000
```

未配置或 `AMAP_ENABLED=false` 时，同步逻辑与改造前一致（景点无坐标则跳过入库）。

## 2. 项目内调用链

```text
POST /api/routes/generate
  → syncAttractionsFromRouteDetail
       → 节点需入库且无坐标？
            → resolveCoordinatesFromAmap(name, city)
                 ① GET /v3/place/text   （关键词 + 城市，首选）
                 ② GET /v3/geocode/geo （「城市+名称」地址，回退）
            → 写入 attractions.latitude / longitude
```

实现位置：

| 文件 | 职责 |
|------|------|
| `packages/server/src/config/amap.ts` | 读环境变量、是否启用 |
| `packages/server/src/services/amap-geocode.service.ts` | 调用高德 REST API |
| `packages/server/src/services/attraction-sync.service.ts` | 同步前自动补坐标 |

## 3. 为何用两个接口？

| API | 适用 | 示例 |
|-----|------|------|
| **place/text** | 有具体 POI 名称 | 「雷峰塔」「外婆家」「西湖国宾馆」 |
| **geocode/geo** | 地址化描述 | place 无结果时用「杭州雷峰塔」做地址解析 |

景点/饭店/酒店名称应优先 **place/text**，比纯地理编码更准确。

## 4. 坐标系说明

高德 Web 服务返回 **GCJ-02（国测局火星坐标）**，国内地图、小程序 `map` 组件通常直接使用。

- 若要与 GPS 原始 WGS84 混用，需做坐标转换（后续 B2 打卡时再统一）。  
- LLM 若输出 WGS84 坐标，与高德混用时可能有百米级偏差，**以高德补全结果为准**更一致。

返回字段格式：`location = "经度,纬度"`（注意顺序，代码中已解析为 `latitude` / `longitude`）。

## 5. 配额与限流

- 个人开发者有日调用量上限，见控制台「配额」。  
- 路线一次生成约 N 个 POI ≈ N 次 place（最多 2N 含回退），注意批量测试频率。  
- 生产建议：对 `(city, name)` 做 Redis 缓存（G1），避免同景点重复请求。

## 6. 验证

```bash
pnpm db:migrate
pnpm dev:server
```

配置好 `AMAP_WEB_KEY` 后，生成一条含**无坐标景点名**的路线（或临时去掉 LLM 的 lat/lng），观察日志：

- 成功：`[attraction-sync]` 不再出现「跳过无坐标景点」  
- 库内：`SELECT name, latitude, longitude FROM attractions ORDER BY id DESC LIMIT 5;`

也可用 curl 单独测高德（替换 KEY、城市、关键词）：

```bash
curl "https://restapi.amap.com/v3/place/text?key=KEY&keywords=雷峰塔&city=杭州&citylimit=true"
```

## 7. 常见问题

| 现象 | 处理 |
|------|------|
| `INVALID_USER_KEY` | Key 类型不是 Web 服务，或 Key 填错 |
| `USERKEY_PLAT_NOMATCH` | 用了 JS/Android Key 调 REST 接口 |
| `DAILY_QUERY_OVER_LIMIT` | 超额，升配额或加缓存 |
| place 无结果 | 检查 `city` 是否与高德城市名一致（如「杭州」）；尝试 geocode 回退 |
| 仍不入库 | 笼统「午餐」等 `poiType=meal` 本来就不入库，与 geocoding 无关 |

## 8. 相关文档

- [搜索 POI](https://lbs.amap.com/api/webservice/guide/api/search)  
- [地理/逆地理编码](https://lbs.amap.com/api/webservice/guide/api/georegeo)  
- 项目开发记录：[开发记录-重难点与亮点.md](./开发记录-重难点与亮点.md)
