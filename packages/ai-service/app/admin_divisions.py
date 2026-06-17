"""全国省/地级行政区划 — 与 @douxing/shared cn-division 数据对齐。"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "shared" / "data" / "admin-divisions"

GB_PROVINCE_SLUG_MAP: dict[str, dict[str, str]] = {
    "11": {"slug": "beijing", "nameZh": "北京"},
    "12": {"slug": "tianjin", "nameZh": "天津"},
    "13": {"slug": "hebei", "nameZh": "河北"},
    "14": {"slug": "shanxi", "nameZh": "山西"},
    "15": {"slug": "neimenggu", "nameZh": "内蒙古"},
    "21": {"slug": "liaoning", "nameZh": "辽宁"},
    "22": {"slug": "jilin", "nameZh": "吉林"},
    "23": {"slug": "heilongjiang", "nameZh": "黑龙江"},
    "31": {"slug": "shanghai", "nameZh": "上海"},
    "32": {"slug": "jiangsu", "nameZh": "江苏"},
    "33": {"slug": "zhejiang", "nameZh": "浙江"},
    "34": {"slug": "anhui", "nameZh": "安徽"},
    "35": {"slug": "fujian", "nameZh": "福建"},
    "36": {"slug": "jiangxi", "nameZh": "江西"},
    "37": {"slug": "shandong", "nameZh": "山东"},
    "41": {"slug": "henan", "nameZh": "河南"},
    "42": {"slug": "hubei", "nameZh": "湖北"},
    "43": {"slug": "hunan", "nameZh": "湖南"},
    "44": {"slug": "guangdong", "nameZh": "广东"},
    "45": {"slug": "guangxi", "nameZh": "广西"},
    "46": {"slug": "hainan", "nameZh": "海南"},
    "50": {"slug": "chongqing", "nameZh": "重庆"},
    "51": {"slug": "sichuan", "nameZh": "四川"},
    "52": {"slug": "guizhou", "nameZh": "贵州"},
    "53": {"slug": "yunnan", "nameZh": "云南"},
    "54": {"slug": "xizang", "nameZh": "西藏"},
    "61": {"slug": "shaanxi", "nameZh": "陕西"},
    "62": {"slug": "gansu", "nameZh": "甘肃"},
    "63": {"slug": "qinghai", "nameZh": "青海"},
    "64": {"slug": "ningxia", "nameZh": "宁夏"},
    "65": {"slug": "xinjiang", "nameZh": "新疆"},
}

LEGACY_CITY_SLUG_BY_ZH: dict[str, str] = {
    "北京": "beijing",
    "上海": "shanghai",
    "重庆": "chongqing",
    "天津": "tianjin",
    "杭州": "hangzhou",
    "成都": "chengdu",
    "西安": "xian",
    "广州": "guangzhou",
    "深圳": "shenzhen",
    "厦门": "xiamen",
    "南京": "nanjing",
    "苏州": "suzhou",
    "武汉": "wuhan",
    "宜昌": "yichang",
    "恩施": "enshi",
    "襄阳": "xiangyang",
    "黄石": "huangshi",
    "十堰": "shiyan",
    "荆州": "jingzhou",
    "神农架": "shennongjia",
    "长沙": "changsha",
    "青岛": "qingdao",
    "大连": "dalian",
    "三亚": "sanya",
    "丽江": "lijiang",
    "桂林": "guilin",
    "昆明": "kunming",
}

INVALID_PREFECTURE_NAMES = {"县", "河南省", "湖北省", "海南省", "新疆维吾尔自治区"}

PROVINCE_NAME_BY_SLUG = {meta["slug"]: meta["nameZh"] for meta in GB_PROVINCE_SLUG_MAP.values()}


def normalize_admin_city_name(raw: str) -> str:
    name = raw.strip()
    name = re.sub(r"市$", "", name)
    name = re.sub(r"土家族苗族自治州$", "恩施", name)
    name = re.sub(r"藏族羌族自治州$", "", name)
    name = re.sub(r"蒙古自治州$", "", name)
    name = re.sub(r"回族自治州$", "", name)
    name = re.sub(r"哈萨克自治州$", "", name)
    name = re.sub(r"柯尔克孜自治州$", "", name)
    name = re.sub(r"布依族苗族自治州$", "", name)
    name = re.sub(r"苗族侗族自治州$", "", name)
    name = re.sub(r"彝族自治州$", "", name)
    name = re.sub(r"傣族自治州$", "", name)
    name = re.sub(r"白族自治州$", "", name)
    name = re.sub(r"傈僳族自治州$", "", name)
    name = re.sub(r"朝鲜族自治州$", "", name)
    name = re.sub(r"地区$", "", name)
    name = re.sub(r"盟$", "", name)
    return name


def _gb_province_code(raw: str | int) -> str:
    return str(raw).zfill(2)[:2]


@lru_cache(maxsize=1)
def _load_cities() -> list[dict]:
    path = DATA_DIR / "cities.json"
    if not path.is_file():
        return []
    with path.open(encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _build_city_to_province_slug() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for city in _load_cities():
        name = city.get("n", "")
        if name in INVALID_PREFECTURE_NAMES:
            continue
        province_gb = _gb_province_code(city.get("p", ""))
        province_meta = GB_PROVINCE_SLUG_MAP.get(province_gb)
        if not province_meta:
            continue
        slug = province_meta["slug"]
        short = normalize_admin_city_name(name)
        for key in {short, name.replace("市", "")}:
            if key and len(key) >= 2 and key not in mapping:
                mapping[key] = slug
    return mapping


def resolve_province_slug_for_city(city_name: str | None) -> str | None:
    if not city_name or not city_name.strip():
        return None
    normalized = normalize_admin_city_name(city_name)
    mapping = _build_city_to_province_slug()
    if normalized in mapping:
        return mapping[normalized]
    for key, slug in mapping.items():
        if normalized in key or key in normalized:
            return slug
    return None


def get_city_names_by_province_slug(province_slug: str) -> list[str]:
    gb = next(
        (code for code, meta in GB_PROVINCE_SLUG_MAP.items() if meta["slug"] == province_slug),
        None,
    )
    if not gb:
        return []
    names: list[str] = []
    for city in _load_cities():
        if _gb_province_code(city.get("p", "")) != gb:
            continue
        name = city.get("n", "")
        if name in INVALID_PREFECTURE_NAMES:
            continue
        names.append(normalize_admin_city_name(name))
    return names


def forbidden_city_examples(exclude_slugs: list[str]) -> str:
    parts: list[str] = []
    for slug in exclude_slugs:
        parts.extend(get_city_names_by_province_slug(slug)[:12])
    return "、".join(parts[:24])
