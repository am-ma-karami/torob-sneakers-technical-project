import logging
import time
from collections import OrderedDict, deque

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes import router
from app.core.config import get_settings
from app.services.catalog import NotFound

settings = get_settings()
app = FastAPI(
    title="RAD · Footwear atlas",
    version="0.1.0",
    docs_url="/api/docs" if settings.environment == "development" else None,
    redoc_url=None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
windows: OrderedDict[str, deque] = OrderedDict()


@app.middleware("http")
async def controls(request: Request, call_next):
    if len(request.url.query) > 8192 or int(request.headers.get("content-length", "0") or 0) > 16384:
        return JSONResponse(
            {"error": {"code": "request_too_large", "message": "Request exceeds size limit"}}, 413
        )
    host = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window = windows.setdefault(host, deque())
    windows.move_to_end(host)
    if len(windows) > 4096:
        windows.popitem(last=False)
    while window and window[0] < now - 60:
        window.popleft()
    if len(window) >= settings.rate_limit:
        return JSONResponse(
            {"error": {"code": "rate_limited", "message": "Please retry in a minute"}},
            429,
            headers={"Retry-After": "60"},
        )
    window.append(now)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.exception_handler(NotFound)
async def not_found(request, exc):
    return JSONResponse({"error": {"code": "not_found", "message": str(exc)}}, 404)


@app.exception_handler(RequestValidationError)
async def invalid(request, exc):
    errors = [{"field": ".".join(map(str, e["loc"])), "message": e["msg"]} for e in exc.errors()]
    return JSONResponse(
        {"error": {"code": "validation_error", "message": "Invalid input", "details": errors}}, 422
    )


@app.exception_handler(SQLAlchemyError)
async def database_error(request, exc):
    logging.getLogger("rad").error("Database operation failed: %s", type(exc).__name__)
    return JSONResponse(
        {"error": {"code": "database_unavailable", "message": "Catalog temporarily unavailable"}}, 503
    )


@app.exception_handler(Exception)
async def unexpected(request, exc):
    logging.getLogger("rad").error("Request failed: %s", type(exc).__name__)
    return JSONResponse({"error": {"code": "internal_error", "message": "Unexpected error"}}, 500)


app.include_router(router)
