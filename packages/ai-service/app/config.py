"""环境变量与 LLM 提供商配置。"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"
LOCAL_ENV = Path(__file__).resolve().parents[2] / ".env"

if ROOT_ENV.exists():
    load_dotenv(ROOT_ENV)
elif LOCAL_ENV.exists():
    load_dotenv(LOCAL_ENV)
else:
    load_dotenv()


def _normalize_base_url(url: str) -> str:
    trimmed = url.rstrip("/")
    return trimmed if trimmed.endswith("/v1") else f"{trimmed}/v1"


@dataclass(frozen=True)
class ProviderConfig:
    id: str
    label: str
    base_url: str
    model: str
    api_key: str
    timeout_ms: int
    configured: bool


def get_service_port() -> int:
    return int(os.getenv("AI_SERVICE_PORT", "8100"))


def has_deepseek_api_key() -> bool:
    key = (os.getenv("DEEPSEEK_API_KEY") or "").strip()
    return bool(key)


def get_deepseek_config() -> ProviderConfig:
    api_key = (os.getenv("DEEPSEEK_API_KEY") or "").strip()
    return ProviderConfig(
        id="deepseek",
        label="DeepSeek 云端",
        base_url=_normalize_base_url(
            os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
        ),
        model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
        api_key=api_key,
        timeout_ms=int(
            os.getenv("DEEPSEEK_TIMEOUT_MS")
            or os.getenv("LLM_TIMEOUT_MS", "120000")
        ),
        configured=bool(api_key),
    )


def get_lmstudio_config() -> ProviderConfig:
    return ProviderConfig(
        id="lmstudio",
        label="本地 LM Studio",
        base_url=_normalize_base_url(
            os.getenv("LLM_BASE_URL", "http://127.0.0.1:1234/v1")
        ),
        model=os.getenv("LLM_MODEL", "local-model"),
        api_key=os.getenv("LLM_API_KEY", "lm-studio"),
        timeout_ms=int(os.getenv("LLM_TIMEOUT_MS", "120000")),
        configured=True,
    )


def has_douxing_api_key() -> bool:
    key = (os.getenv("DOUXING_LLM_API_KEY") or "").strip()
    model = (os.getenv("DOUXING_LLM_MODEL") or "").strip()
    return bool(key and model)


def is_douxing_enabled() -> bool:
    if (os.getenv("DOUXING_LLM_ENABLED") or "").strip().lower() == "false":
        return False
    return has_douxing_api_key()


def get_douxing_config() -> ProviderConfig:
    api_key = (os.getenv("DOUXING_LLM_API_KEY") or "").strip()
    return ProviderConfig(
        id="douxing",
        label="兜行百炼微调",
        base_url=_normalize_base_url(
            os.getenv(
                "DOUXING_LLM_BASE_URL",
                "https://dashscope.aliyuncs.com/compatible-mode/v1",
            )
        ),
        model=os.getenv("DOUXING_LLM_MODEL", "douxing-planner"),
        api_key=api_key,
        timeout_ms=int(
            os.getenv("DOUXING_LLM_TIMEOUT_MS")
            or os.getenv("LLM_TIMEOUT_MS", "120000")
        ),
        configured=bool(api_key),
    )


def get_provider_config(provider_id: str) -> ProviderConfig:
    if provider_id == "douxing":
        return get_douxing_config()
    if provider_id == "deepseek":
        return get_deepseek_config()
    return get_lmstudio_config()


def resolve_provider_chain(choice: str | None = None) -> list[str]:
    selected = (choice or os.getenv("LLM_DEFAULT_PROVIDER", "auto")).strip().lower()
    if selected == "douxing":
        return ["douxing"] if is_douxing_enabled() else []
    if selected == "deepseek":
        return ["deepseek"] if has_deepseek_api_key() else []
    if selected in {"lmstudio", "local", "lm-studio"}:
        return ["lmstudio"]
    chain: list[str] = []
    if is_douxing_enabled():
        chain.append("douxing")
    if has_deepseek_api_key():
        chain.append("deepseek")
    chain.append("lmstudio")
    return chain
