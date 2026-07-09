"""FastAPI 入口。"""

from __future__ import annotations

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import get_workflow_engine
from app.logging_config import setup_ai_service_logging
from app.route_generator import check_provider_status, generate_route
from app.agent.graph import run_plan_agent
from app.workflow.engine import run_transit_with_engine
from app.observability.langfuse_client import flush_langfuse, is_langfuse_enabled, get_langfuse_host
from app.schemas import (
    AgentPlanRequest,
    AgentPlanResponse,
    AgentTransitRequest,
    AgentTransitResponse,
    GenerateRouteRequest,
    GenerateRouteResponse,
    ObservabilityStatus,
    ServiceStatusResponse,
)

app = FastAPI(
    title="兜行 AI 服务",
    description="Python AI 微服务：LangChain 路线规划",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_ai_service_logging()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "douxing-ai-service"}


@app.get("/v1/status", response_model=ServiceStatusResponse)
async def service_status() -> ServiceStatusResponse:
    providers = [
        await check_provider_status("deepseek"),
        await check_provider_status("lmstudio"),
    ]
    return ServiceStatusResponse(
        service="douxing-ai-service",
        version="1.0.0",
        providers=providers,
        observability=ObservabilityStatus(
            langfuse=is_langfuse_enabled(),
            langfuseHost=get_langfuse_host() if is_langfuse_enabled() else None,
        ),
        workflowEngine=get_workflow_engine(),
    )


@app.post("/v1/route/generate", response_model=GenerateRouteResponse)
async def route_generate(request: GenerateRouteRequest) -> GenerateRouteResponse:
    try:
        return await generate_route(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI 服务内部错误: {exc}") from exc
    finally:
        flush_langfuse()


@app.post("/v1/agent/plan", response_model=AgentPlanResponse)
async def agent_plan(
    request: AgentPlanRequest,
    x_workflow_engine: str | None = Header(default=None, alias="X-Workflow-Engine"),
) -> AgentPlanResponse:
    try:
        result = await run_plan_agent(
            request.model_dump(),
            engine_override=x_workflow_engine,
        )
        return AgentPlanResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent 规划失败: {exc}") from exc
    finally:
        flush_langfuse()


@app.post("/v1/agent/plan/stream")
async def agent_plan_stream(
    request: AgentPlanRequest,
    x_workflow_engine: str | None = Header(default=None, alias="X-Workflow-Engine"),
) -> StreamingResponse:
    """
    Agent 规划 SSE 流：执行过程中推送 tool_call，结束时推送 done。

    @param request - AgentPlanRequest
    @param x_workflow_engine - 可选引擎覆盖头
    @returns text/event-stream 响应
    """
    from app.workflow.streaming import iter_plan_agent_sse

    try:
        return StreamingResponse(
            iter_plan_agent_sse(
                request.model_dump(),
                engine_override=x_workflow_engine,
            ),
            media_type="text/event-stream; charset=utf-8",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent 规划流失败: {exc}") from exc


@app.post("/v1/agent/transit", response_model=AgentTransitResponse)
async def agent_transit(
    request: AgentTransitRequest,
    x_workflow_engine: str | None = Header(default=None, alias="X-Workflow-Engine"),
) -> AgentTransitResponse:
    try:
        result = await run_transit_with_engine(
            request.model_dump(),
            engine_override=x_workflow_engine,
        )
        return AgentTransitResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"行中 Agent 失败: {exc}") from exc
    finally:
        flush_langfuse()
