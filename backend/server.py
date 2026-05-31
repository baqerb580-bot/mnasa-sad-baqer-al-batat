"""
FastAPI proxy on port 8001.

The infrastructure routes external traffic with prefix `/api/*` to this
backend on port 8001, while non-api traffic goes to port 3000 (Next.js).

This Next.js application keeps ALL of its API routes inside the same
Next.js process (port 3000) via the catch-all route `app/api/[[...path]]`.
So this proxy simply forwards `/api/*` to `http://localhost:3000` to keep
the Next.js full-stack app working on Emergent's React+FastAPI base image.
"""
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse, JSONResponse
import httpx
import logging

NEXT_TARGET = "http://localhost:3000"

app = FastAPI()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("proxy")

# Reuse a single async client (long timeout for slow API routes / SSE)
_client = httpx.AsyncClient(
    base_url=NEXT_TARGET,
    timeout=httpx.Timeout(120.0, connect=10.0),
    follow_redirects=False,
)


@app.on_event("shutdown")
async def _shutdown():
    await _client.aclose()


HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-encoding",
    "content-length",
}


@app.get("/")
async def root():
    return {"status": "ok", "service": "nextjs-api-proxy", "target": NEXT_TARGET}


@app.api_route(
    "/api/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy(full_path: str, request: Request):
    upstream_path = f"/api/{full_path}"
    query = request.url.query
    if query:
        upstream_path = f"{upstream_path}?{query}"

    body = await request.body()

    headers = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in {"host", "content-length"}
    }

    try:
        upstream = await _client.request(
            request.method,
            upstream_path,
            headers=headers,
            content=body,
        )
    except httpx.RequestError as exc:
        logger.error("Upstream error %s %s -> %s", request.method, upstream_path, exc)
        return JSONResponse(
            {"error": "upstream_unavailable", "detail": str(exc)},
            status_code=502,
        )

    resp_headers = {
        k: v for k, v in upstream.headers.items() if k.lower() not in HOP_BY_HOP
    }

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=resp_headers,
        media_type=upstream.headers.get("content-type"),
    )
