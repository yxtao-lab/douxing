"""LangChain 路线生成核心逻辑。"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import ValidationError

from app.config import ProviderConfig, get_provider_config, resolve_provider_chain
from app.prompts import build_system_prompt
from app.schemas import (
    GenerateRouteRequest,
    GenerateRouteResponse,
    LlmRoutePayload,
    ProviderStatus,
    RagAttractionCandidate,
    TravelIntentSnapshot,
)


def format_intent_constraints_for_llm(intent: TravelIntentSnapshot) -> str:
    lines = ["【用户约束 — 必须严格遵守】"]
    if intent.city:
        lines.append(f"- 目的地城市：{intent.city}")
    if intent.days is not None:
        lines.append(
            f"- 行程天数：{intent.days} 天（routeDetail.days 长度必须等于 {intent.days}）"
        )
    if intent.budget:
        if intent.budgetMin is not None and intent.budgetMax is not None:
            lines.append(
                f'- 预算范围：{intent.budgetMin}-{intent.budgetMax} 元，'
                f'budgetRange 字段填 "{intent.budgetMin}-{intent.budgetMax}"'
            )
        else:
            lines.append(f"- 预算：{intent.budget}")
    if intent.themes:
        lines.append(
            f"- 主题偏好：{'、'.join(intent.themes)}，interestTags 须包含这些标签"
        )
    if len(lines) == 1:
        return ""
    return "\n".join(lines)


def format_rag_context_for_llm(candidates: list[RagAttractionCandidate]) -> str:
    if not candidates:
        return ""

    compact = [
        {
            "id": c.id,
            "name": c.name,
            "category": c.category,
            "tags": c.tags,
            "ticketPrice": c.ticketPrice,
            "description": (c.description or "")[:80],
            "latitude": c.latitude,
            "longitude": c.longitude,
        }
        for c in candidates
    ]
    return "\n".join(
        [
            "【内容库候选 POI — poiType=attraction 时必须优先从中选用】",
            "- name 必须与下列 name 完全一致，禁止自造未在库中的景区名",
            "- cost 使用 ticketPrice；坐标使用 latitude/longitude",
            json.dumps(compact, ensure_ascii=False),
        ]
    )


def extract_json_object(text: str) -> str:
    trimmed = text.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", trimmed, re.IGNORECASE)
    if fenced and fenced.group(1):
        return fenced.group(1).strip()

    start = trimmed.find("{")
    end = trimmed.rfind("}")
    if start >= 0 and end > start:
        return trimmed[start : end + 1]
    return trimmed


async def resolve_model_id(config: ProviderConfig) -> str:
    if config.id == "deepseek" or (
        config.model and config.model != "local-model"
    ):
        return config.model

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{config.base_url}/models",
                headers=_auth_headers(config.api_key),
            )
            if response.is_success:
                data = response.json()
                for item in data.get("data", []):
                    model_id = item.get("id")
                    if model_id and "embed" not in model_id:
                        return model_id
    except Exception:
        pass
    return config.model


def _auth_headers(api_key: str) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def _build_user_content(request: GenerateRouteRequest) -> str:
    blocks: list[str] = []
    if request.intent:
        constraint = format_intent_constraints_for_llm(request.intent)
        if constraint:
            blocks.append(constraint)
    else:
        if request.days:
            blocks.append(f"（期望天数：{request.days}天）")
        if request.budget:
            blocks.append(f"（预算：{request.budget}）")
    if request.ragCandidates:
        blocks.append(format_rag_context_for_llm(request.ragCandidates))
    if request.variantHint and request.variantHint.strip():
        blocks.append(
            f"【本方案风格 — 与其他候选路线需有明显差异】\n{request.variantHint.strip()}"
        )

    if blocks:
        return f"{chr(10).join(blocks)}\n\n用户需求：{request.prompt}"
    return request.prompt


def _build_messages(request: GenerateRouteRequest) -> list[Any]:
    history = request.history or []
    messages: list[Any] = [
        SystemMessage(content=build_system_prompt(len(history) > 0)),
    ]
    for item in history:
        if item.role == "user":
            messages.append(HumanMessage(content=item.content))
        else:
            messages.append(AIMessage(content=item.content))
    messages.append(HumanMessage(content=_build_user_content(request)))
    return messages


def _parse_route_payload(raw_text: str, provider_label: str) -> LlmRoutePayload:
    json_text = extract_json_object(raw_text)
    try:
        parsed = json.loads(json_text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{provider_label} 返回的不是有效 JSON") from exc

    try:
        payload = LlmRoutePayload.model_validate(parsed)
    except ValidationError as exc:
        first = exc.errors()[0]
        message = first.get("msg", "格式不符合要求")
        raise ValueError(f"返回格式不符合要求: {message}") from exc

    if len(payload.routeDetail.days) != payload.days:
        payload.days = len(payload.routeDetail.days)
    return payload


async def _generate_with_provider(
    provider_id: str,
    request: GenerateRouteRequest,
) -> GenerateRouteResponse:
    config = get_provider_config(provider_id)
    if not config.configured:
        raise ValueError(f"{config.label} 未配置")

    model = await resolve_model_id(config)
    llm = ChatOpenAI(
        model=model,
        base_url=config.base_url,
        api_key=config.api_key or "empty",
        temperature=0.6,
        max_tokens=2048,
        timeout=config.timeout_ms / 1000,
        model_kwargs=(
            {"response_format": {"type": "json_object"}}
            if provider_id == "deepseek"
            else {}
        ),
    )

    messages = _build_messages(request)
    try:
        response = await llm.ainvoke(messages)
    except Exception as exc:
        if provider_id != "deepseek":
            raise ValueError(f"{config.label} 请求失败: {exc}") from exc
        llm = ChatOpenAI(
            model=model,
            base_url=config.base_url,
            api_key=config.api_key or "empty",
            temperature=0.6,
            max_tokens=2048,
            timeout=config.timeout_ms / 1000,
        )
        response = await llm.ainvoke(messages)

    content = response.content
    if isinstance(content, list):
        content = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )
    if not content or not str(content).strip():
        raise ValueError(f"{config.label} 返回内容为空")

    payload = _parse_route_payload(str(content), config.label)
    return GenerateRouteResponse(payload=payload, provider=provider_id)  # type: ignore[arg-type]


async def generate_route(request: GenerateRouteRequest) -> GenerateRouteResponse:
    chain = resolve_provider_chain(request.provider)
    if not chain:
        raise ValueError("未配置任何可用模型（请设置 DEEPSEEK_API_KEY 或启动 LM Studio）")

    errors: list[str] = []
    for provider_id in chain:
        try:
            return await _generate_with_provider(provider_id, request)
        except Exception as exc:
            config = get_provider_config(provider_id)
            message = str(exc)
            errors.append(f"{config.label}: {message}")
    raise ValueError(" | ".join(errors))


async def check_provider_status(provider_id: str) -> ProviderStatus:
    config = get_provider_config(provider_id)
    base = ProviderStatus(
        id=config.id,
        label=config.label,
        configured=config.configured,
        available=False,
    )
    if not config.configured:
        error = (
            "未配置 DEEPSEEK_API_KEY"
            if provider_id == "deepseek"
            else "本地服务未配置"
        )
        return base.model_copy(update={"error": error})

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{config.base_url}/models",
                headers=_auth_headers(config.api_key),
            )
            if not response.is_success:
                return base.model_copy(update={"error": f"HTTP {response.status_code}"})
            data = response.json()
            model = config.model
            if provider_id != "deepseek":
                for item in data.get("data", []):
                    model_id = item.get("id")
                    if model_id and "embed" not in model_id:
                        model = model_id
                        break
            return base.model_copy(update={"available": True, "model": model})
    except Exception as exc:
        return base.model_copy(update={"error": str(exc)})
