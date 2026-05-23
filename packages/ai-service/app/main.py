"""FastAPI 入口。"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.route_generator import check_provider_status, generate_route
from app.schemas import GenerateRouteRequest, GenerateRouteResponse, ServiceStatusResponse

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
    )


@app.post("/v1/route/generate", response_model=GenerateRouteResponse)
async def route_generate(request: GenerateRouteRequest) -> GenerateRouteResponse:
    try:
        return await generate_route(request)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI 服务内部错误: {exc}") from exc
