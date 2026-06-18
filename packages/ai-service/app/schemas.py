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
    transportPreference: str | None = None
    lodgingArea: str | None = None
    lodgingTier: str | None = None
    cities: list[str] = Field(default_factory=list)
    startDate: str | None = None
    departureCity: str | None = None
    excludeProvinceCodes: list[str] = Field(default_factory=list)
    suggestedDestinations: list[str] = Field(default_factory=list)
    constraintSummary: str | None = None
    intentSource: Literal["rule", "llm", "hybrid"] | None = None


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
    time: str = ""
    cost: float
    description: str
    poiType: str
    latitude: float | None = None
    longitude: float | None = None


class RouteDay(BaseModel):
    date: str
    calendarDate: str | None = None
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


class PlaybookMatch(BaseModel):
    id: str
    city: str
    scope: str
    summary: str
    classicOrder: list[str] = Field(default_factory=list)
    score: float = 0


class GenerateRouteRequest(BaseModel):
    prompt: str
    days: int | None = Field(default=None, ge=1, le=7)
    budget: str | None = None
    provider: Literal["auto", "deepseek", "lmstudio"] | None = "auto"
    history: list[PlanChatMessage] = Field(default_factory=list)
    intent: TravelIntentSnapshot | None = None
    ragCandidates: list[RagAttractionCandidate] = Field(default_factory=list)
    playbookMatches: list[PlaybookMatch] = Field(default_factory=list)
    variantHint: str | None = None
    locale: str | None = "zh-CN"
    userId: int | None = None
    sessionId: int | None = None


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


class ObservabilityStatus(BaseModel):
    langfuse: bool = False
    langfuseHost: str | None = None


class ServiceStatusResponse(BaseModel):
    service: str
    version: str
    providers: list[ProviderStatus]
    observability: ObservabilityStatus | None = None


class AgentPlanRequest(BaseModel):
    prompt: str
    userId: int
    sessionId: int | None = None
    history: list[PlanChatMessage] = Field(default_factory=list)
    days: int | None = None
    budget: str | None = None
    locale: str | None = "zh-CN"
    provider: str | None = None
    currentDraft: dict | None = None
    intent: dict | None = None


class AgentPlanResponse(BaseModel):
    draft: dict | None = None
    candidates: list[dict] = Field(default_factory=list)
    toolTrace: list[dict] = Field(default_factory=list)
    routedIntent: str = "plan_new"
    assistantHint: str | None = None
    assistantMessage: str | None = None
    selectedRouteId: int | None = None
    memories: list[dict] = Field(default_factory=list)
    memorySummary: str | None = None
    recallExplain: list[dict] = Field(default_factory=list)


class AgentTransitRequest(BaseModel):
    routeId: int
    userId: int
    locale: str | None = "zh-CN"
    context: dict


class AgentTransitResponse(BaseModel):
    routeId: int | None = None
    dayIndex: int | None = None
    day: dict | None = None
    segment: dict | None = None
    diff: dict | None = None
    toolTrace: list[dict] = Field(default_factory=list)
