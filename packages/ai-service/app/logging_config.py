"""ai-service 日志：控制台 + 文件（供管理端日志管理读取）。"""

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path


def setup_ai_service_logging() -> Path:
    """
    配置根日志：stdout 与滚动文件 packages/ai-service/logs/ai-service.log。

    @returns 日志文件路径
    """
    log_dir = Path(__file__).resolve().parents[1] / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "ai-service.log"

    root = logging.getLogger()
    if getattr(root, "_douxing_ai_configured", False):
        return log_file

    root.setLevel(logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    root.addHandler(stream_handler)

    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)

    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv_logger = logging.getLogger(logger_name)
        uv_logger.handlers.clear()
        uv_logger.propagate = True

    # 开发模式 watchfiles 监听日志文件变更会反复写「1 change detected」，抬高级别避免刷屏
    logging.getLogger("watchfiles").setLevel(logging.WARNING)

    root._douxing_ai_configured = True  # type: ignore[attr-defined]
    logging.getLogger(__name__).info("[logging] 已写入文件 %s", log_file)
    return log_file
