"""Bound API request bodies before JSON parsing, including chunked requests."""

from collections import deque

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class BodyLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int = 16384):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        try:
            declared = int(headers.get(b"content-length", b"0"))
            if declared < 0:
                raise ValueError
        except ValueError:
            return await JSONResponse(
                {"error": {"code": "invalid_length", "message": "Invalid content length"}}, 400
            )(scope, receive, send)
        if declared > self.max_bytes:
            return await self.reject(scope, receive, send)
        if scope.get("method") in ["POST", "PUT", "PATCH"]:
            messages: deque[Message] = deque()
            size = 0
            while True:
                message = await receive()
                messages.append(message)
                if message["type"] == "http.disconnect":
                    break
                size += len(message.get("body", b""))
                if size > self.max_bytes:
                    return await self.reject(scope, receive, send)
                if not message.get("more_body", False):
                    break

            async def buffered_receive():
                return messages.popleft() if messages else await receive()

            return await self.app(scope, buffered_receive, send)
        return await self.app(scope, receive, send)

    async def reject(self, scope, receive, send):
        await JSONResponse(
            {"error": {"code": "request_too_large", "message": "Request exceeds size limit"}}, 413
        )(scope, receive, send)
