"""请求/响应 Pydantic 模型。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class PlanChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class TravelIntentSnapshot(BaseModel):
    city: str | None = None
    days: int | None = None
    budget: str | None = None
    budgetMin: int | None = None
    budgetMax: int | None = None
    themes: list[str] = Field(default_factory=list)
    confidence: Literal["low", "medium", "high"] = "low"


class RagAttractionCandidate(BaseModel):
    id: int
    name: str
    category: str
    tags: list[str] = Field(default_factory=list)
    description: str | None = None
    ticketPrice: float = 0
    latitude: float | None = None
    longitude: float | None = None
    aliases: list[str] = Field(default_factory=list)
    score: float = 0


class RouteSpot(BaseModel):
    name: str
    time: str
    cost: float
    description: str
    poiType: str
    latitude: float | None = None
    longitude: float | None = None


class RouteDay(BaseModel):
    date: str
    title: str
    attractions: list[RouteSpot]


class RouteDetail(BaseModel):
    days: list[RouteDay]


class LlmRoutePayload(BaseModel):
    name: str
    description: str
    budgetRange: str
    days: int = Field(ge=1, le=7)
    interestTags: list[str]
    matchedCity: str
    unlockPrice: float = Field(ge=0, le=999)
    routeDetail: RouteDetail


class GenerateRouteRequest(BaseModel):
    prompt: str
    days: int | None = Field(default=None, ge=1, le=7)
    budget: str | None = None
    provider: Literal["auto", "deepseek", "lmstudio"] | None = "auto"
    history: list[PlanChatMessage] = Field(default_factory=list)
    intent: TravelIntentSnapshot | None = None
    ragCandidates: list[RagAttractionCandidate] = Field(default_factory=list)
    variantHint: str | None = None


class GenerateRouteResponse(BaseModel):
    payload: LlmRoutePayload
    provider: Literal["deepseek", "lmstudio"]


class ProviderStatus(BaseModel):
    id: str
    label: str
    configured: bool
    available: bool
    model: str | None = None
    error: str | None = None


class ServiceStatusResponse(BaseModel):
    service: str
    version: str
    providers: list[ProviderStatus]
