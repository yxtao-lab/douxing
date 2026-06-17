"""Langfuse 观测（Step 11）：未配置 KEY 时零开销 no-op。"""



from __future__ import annotations



import contextvars

import json

import os

from contextlib import contextmanager

from typing import Any, Iterator



_enabled: bool | None = None

_root_span_ctx: contextvars.ContextVar[Any | None] = contextvars.ContextVar(

    "langfuse_root_span",

    default=None,

)



_SENSITIVE_KEYS = frozenset(

    {

        "secret",

        "password",

        "token",

        "apikey",

        "api_key",

        "authorization",

        "x-agent-tool-secret",

    }

)





class _NoOpObservation:

    def update(self, **_kwargs: Any) -> None:

        return None





NOOP = _NoOpObservation()





def is_langfuse_enabled() -> bool:

    global _enabled

    if _enabled is None:

        public_key = (os.getenv("LANGFUSE_PUBLIC_KEY") or "").strip()

        secret_key = (os.getenv("LANGFUSE_SECRET_KEY") or "").strip()

        _enabled = bool(public_key and secret_key)

    return _enabled





def get_langfuse_host() -> str:

    base_url = (os.getenv("LANGFUSE_BASE_URL") or os.getenv("LANGFUSE_HOST") or "").strip()

    return (base_url or "https://cloud.langfuse.com").rstrip("/")





def _ensure_langfuse_env() -> None:

    host = get_langfuse_host()

    os.environ.setdefault("LANGFUSE_HOST", host)

    os.environ.setdefault("LANGFUSE_BASE_URL", host)

    tracing_env = (os.getenv("LANGFUSE_TRACING_ENVIRONMENT") or "default").strip().lower()
    os.environ.setdefault("LANGFUSE_TRACING_ENVIRONMENT", tracing_env)





def _get_client() -> Any | None:

    if not is_langfuse_enabled():

        return None

    _ensure_langfuse_env()

    from langfuse import get_client



    return get_client()





def _truncate(value: Any, max_len: int = 4000) -> Any:

    if isinstance(value, dict):

        return {k: _truncate(v, max_len) for k, v in list(value.items())[:40]}

    if isinstance(value, list):

        return [_truncate(item, max_len) for item in value[:30]]

    if isinstance(value, str):

        if len(value) <= max_len:

            return value

        return f"{value[:max_len]}…"

    try:

        text = json.dumps(value, ensure_ascii=False)

        if len(text) <= max_len:

            return value

        return f"{text[:max_len]}…"

    except TypeError:

        text = str(value)

        return text if len(text) <= max_len else f"{text[:max_len]}…"





def _sanitize_tool_payload(payload: dict[str, Any] | None) -> dict[str, Any]:

    if not payload:

        return {}

    sanitized: dict[str, Any] = {}

    for key, value in payload.items():

        normalized = key.lower().replace("-", "_")

        if any(part in normalized for part in _SENSITIVE_KEYS):

            sanitized[key] = "[REDACTED]"

            continue

        if key in {"ragCandidates", "currentDraft", "history"} and isinstance(value, (list, dict)):

            sanitized[key] = _truncate(value, max_len=1200)

            continue

        sanitized[key] = _truncate(value, max_len=800)

    return sanitized





def flush_langfuse() -> None:

    client = _get_client()

    if client:

        client.flush()





def get_langchain_callbacks() -> list[Any]:

    """LangChain CallbackHandler：自动采集 model / token / generation 层级。"""

    if not is_langfuse_enabled():

        return []

    try:

        from langfuse.langchain import CallbackHandler



        return [CallbackHandler()]

    except Exception:

        return []





@contextmanager

def _root_trace(

    *,

    name: str,

    input_data: dict[str, Any],

    tags: list[str],

    user_id: int | None = None,

    session_id: int | str | None = None,

) -> Iterator[Any]:

    client = _get_client()

    if not client:

        yield NOOP

        return



    from langfuse import propagate_attributes



    propagate_kwargs: dict[str, Any] = {

        "trace_name": name,

        "tags": tags,

    }

    if user_id is not None:

        propagate_kwargs["user_id"] = str(user_id)

    if session_id is not None:

        propagate_kwargs["session_id"] = str(session_id)



    with propagate_attributes(**propagate_kwargs):

        with client.start_as_current_observation(

            as_type="span",

            name=name,

            input=_truncate(input_data, max_len=800),

        ) as span:

            token = _root_span_ctx.set(span)

            try:

                yield span

            finally:

                _root_span_ctx.reset(token)

                flush_langfuse()





@contextmanager

def agent_plan_trace(

    *,

    user_id: int,

    session_id: int | None,

    prompt: str,

    locale: str | None,

) -> Iterator[Any]:

    locale_value = locale or "zh-CN"

    with _root_trace(

        name="agent-plan",

        input_data={"prompt": prompt[:800], "locale": locale_value},

        tags=["c7", "agent-plan", "feature:agent-plan", f"locale:{locale_value}"],

        user_id=user_id,

        session_id=session_id,

    ) as span:

        yield span





@contextmanager

def route_generate_trace(

    *,

    prompt: str,

    provider: str | None = None,

    user_id: int | None = None,

    session_id: int | None = None,

    locale: str | None = None,

) -> Iterator[Any]:

    existing = _root_span_ctx.get()

    if existing is not None:

        yield existing

        return



    locale_value = locale or "zh-CN"

    tags = ["c5", "route-generate", "feature:route-generate", f"locale:{locale_value}"]

    if provider:

        tags.append(f"provider:{provider}")



    with _root_trace(

        name="route-generate",

        input_data={"prompt": prompt[:800], "provider": provider, "locale": locale_value},

        tags=tags,

        user_id=user_id,

        session_id=session_id,

    ) as span:

        yield span





def _record_child_observation(

    *,

    name: str,

    as_type: str,

    input_data: Any,

    output_data: Any,

    metadata: dict[str, Any] | None = None,

    level: str = "DEFAULT",

) -> None:

    if _root_span_ctx.get() in (None, NOOP):

        return

    client = _get_client()

    if not client:

        return



    observation = client.start_observation(

        as_type=as_type,

        name=name,

        input=input_data,

        metadata=metadata,

        level=level,

    )

    observation.update(output=output_data)

    observation.end()





def record_tool_observation(

    tool_name: str,

    payload: dict[str, Any] | None,

    result: dict[str, Any] | None,

    duration_ms: int,

    *,

    ok: bool = True,

) -> None:

    _record_child_observation(

        name=f"tool:{tool_name}",

        as_type="tool",

        input_data=_sanitize_tool_payload(payload),

        output_data=_truncate(result or {}),

        metadata={"durationMs": duration_ms, "ok": ok, "feature": "agent-plan"},

        level="ERROR" if not ok else "DEFAULT",

    )





def record_route_intent_observation(

    message: str,

    routed: dict[str, Any],

    duration_ms: int,

) -> None:

    _record_child_observation(

        name="route-intent",

        as_type="span",

        input_data={"message": message[:500]},

        output_data=_truncate(routed),

        metadata={

            "durationMs": duration_ms,

            "route": routed.get("route"),

            "feature": "agent-plan",

        },

    )





def record_route_generate_trace(

    *,

    provider: str,

    city: str | None,

    days: int | None,

) -> None:

    span = _root_span_ctx.get()

    if span in (None, NOOP):

        return

    span.update(

        output={"provider": provider, "matchedCity": city, "days": days},

        metadata={"provider": provider, "feature": "route-generate"},

    )


