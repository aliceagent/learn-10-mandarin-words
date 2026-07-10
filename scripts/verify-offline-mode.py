#!/usr/bin/env python3
"""Browser-level offline verification for Learn 10 Mandarin Words.

This intentionally uses the system Chromium + Chrome DevTools Protocol instead
of a test-only DOM fake. It proves the important flight path:

  online load -> service worker ready -> prepare app pack -> browser offline ->
  reload/navigate routes -> app still renders from Cache Storage.

Run against a production build/server, not `next dev`, because the app registers
its service worker only in production.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

import websockets

APP_CACHE = "learn10-v2"
DEFAULT_ROUTES = [
    "/",
    "/offline",
    "/path",
    "/review",
    "/practice",
    "/favorites",
    "/settings",
    "/stats",
    "/categories/animals-and-living-things",
    "/topics/ten-types-of-pets?m=cards",
]

CORE_OFFLINE_ROUTES = [
    "/",
    "/path",
    "/review",
    "/practice",
    "/favorites",
    "/stats",
    "/settings",
    "/offline",
    "/daily",
    "/comeback",
    "/duel",
    "/lightning",
    "/tone-pairs",
    "/privacy",
]
CORE_OFFLINE_ASSETS = ["/search-index.json", "/manifest.webmanifest", "/icon.svg", "/icon-maskable.svg", "/favicon.ico"]


def local_offline_manifest_urls() -> list[str]:
    topics_path = os.path.join(os.path.dirname(__file__), "..", "src", "data", "topics.json")
    try:
        with open(topics_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except OSError:
        return []
    urls = [
        *CORE_OFFLINE_ROUTES,
        *CORE_OFFLINE_ASSETS,
        *(f"/categories/{category['slug']}" for category in data.get("categories", [])),
        *(f"/topics/{topic['slug']}" for topic in data.get("topics", [])),
    ]
    return list(dict.fromkeys(urls))


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def wait_json(url: str, timeout: float = 15.0) -> dict[str, Any]:
    deadline = time.time() + timeout
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001 - diagnostics only
            last_error = exc
            time.sleep(0.1)
    raise RuntimeError(f"Timed out waiting for {url}: {last_error}")


@dataclass
class CdpClient:
    ws: Any
    next_id: int = 1

    async def send(self, method: str, params: dict[str, Any] | None = None, session_id: str | None = None) -> Any:
        msg_id = self.next_id
        self.next_id += 1
        payload: dict[str, Any] = {"id": msg_id, "method": method, "params": params or {}}
        if session_id:
            payload["sessionId"] = session_id
        await self.ws.send(json.dumps(payload))
        while True:
            msg = json.loads(await self.ws.recv())
            if msg.get("id") != msg_id:
                continue
            if "error" in msg:
                raise RuntimeError(f"CDP {method} failed: {msg['error']}")
            return msg.get("result", {})


async def evaluate(client: CdpClient, session_id: str, expression: str, *, timeout_ms: int = 30000) -> Any:
    result = await asyncio.wait_for(
        client.send(
            "Runtime.evaluate",
            {
                "expression": expression,
                "awaitPromise": True,
                "returnByValue": True,
                "timeout": timeout_ms,
            },
            session_id=session_id,
        ),
        timeout=(timeout_ms / 1000) + 5,
    )
    value = result.get("result", {})
    if value.get("subtype") == "error" or "exceptionDetails" in result:
        raise RuntimeError(f"Runtime evaluation failed: {result}")
    return value.get("value")


async def wait_for(client: CdpClient, session_id: str, expression: str, *, timeout: float, label: str) -> Any:
    deadline = time.time() + timeout
    last_value: Any = None
    while time.time() < deadline:
        try:
            last_value = await evaluate(client, session_id, expression, timeout_ms=5000)
            if last_value:
                return last_value
        except Exception as exc:  # noqa: BLE001 - keep polling while page settles
            last_value = repr(exc)
        await asyncio.sleep(0.25)
    raise RuntimeError(f"Timed out waiting for {label}; last value={last_value!r}")


async def navigate(client: CdpClient, session_id: str, url: str) -> None:
    await client.send("Page.navigate", {"url": url}, session_id=session_id)
    await wait_for(
        client,
        session_id,
        "document.readyState === 'complete' || document.readyState === 'interactive'",
        timeout=20,
        label=f"page load {url}",
    )


async def verify(args: argparse.Namespace) -> None:
    chromium = args.chromium or shutil.which("chromium-browser") or shutil.which("chromium") or shutil.which("google-chrome")
    if not chromium:
        raise RuntimeError("No Chromium executable found")

    base_url = args.base_url.rstrip("/")
    debug_port = free_port()
    profile = tempfile.mkdtemp(prefix="learn10-offline-profile-")
    proc = subprocess.Popen(
        [
            chromium,
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            f"--remote-debugging-port={debug_port}",
            f"--user-data-dir={profile}",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE if args.verbose else subprocess.DEVNULL,
        text=True,
    )

    try:
        version = wait_json(f"http://127.0.0.1:{debug_port}/json/version")
        async with websockets.connect(version["webSocketDebuggerUrl"], max_size=2**24) as ws:
            client = CdpClient(ws)
            target = await client.send("Target.createTarget", {"url": "about:blank"})
            attached = await client.send("Target.attachToTarget", {"targetId": target["targetId"], "flatten": True})
            session_id = attached["sessionId"]
            for method in ("Page.enable", "Runtime.enable", "Network.enable"):
                await client.send(method, {}, session_id=session_id)

            print(f"ONLINE load: {base_url}/")
            await navigate(client, session_id, f"{base_url}/")

            sw_state = await wait_for(
                client,
                session_id,
                """
                (async () => {
                  if (!('serviceWorker' in navigator)) return false;
                  const reg = await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise(resolve => setTimeout(() => resolve(null), 3000)),
                  ]);
                  return !!reg && !!reg.active;
                })()
                """,
                timeout=20,
                label="active service worker",
            )
            if not sw_state:
                raise RuntimeError("Service worker did not become ready. Are you running a production build, not next dev?")
            print("SW ready")

            await wait_for(
                client,
                session_id,
                "[...document.querySelectorAll('button')].some(b => !b.disabled && (b.textContent.includes('Prepare app for offline') || b.textContent.includes('Refresh offline app pack') || b.textContent.includes('Finish offline setup')))",
                timeout=15,
                label="enabled offline prepare button",
            )
            await evaluate(
                client,
                session_id,
                """
                (() => {
                  const button = [...document.querySelectorAll('button')].find(b =>
                    !b.disabled && (
                      b.textContent.includes('Prepare app for offline') ||
                      b.textContent.includes('Refresh offline app pack') ||
                      b.textContent.includes('Finish offline setup')
                    )
                  );
                  if (!button) return false;
                  button.click();
                  return true;
                })()
                """,
            )
            print("Preparing app offline pack…")
            try:
                ready_text = await wait_for(
                    client,
                    session_id,
                    "document.body.innerText.includes('Ready for offline study')",
                    timeout=args.prepare_timeout,
                    label="offline app pack ready",
                )
            except Exception:
                body_text = await evaluate(
                    client,
                    session_id,
                    "document.body.innerText.slice(0, 1200)",
                    timeout_ms=5000,
                )
                cache_count = await evaluate(
                    client,
                    session_id,
                    f"caches.open('{APP_CACHE}').then(c => c.keys()).then(k => k.length).catch(() => -1)",
                    timeout_ms=5000,
                )
                missing: list[str] = []
                manifest = local_offline_manifest_urls()
                if manifest:
                    missing_expr = """
                    (async (manifest) => {
                      const cache = await caches.open('%s');
                      const missing = [];
                      for (const url of manifest) {
                        if (!(await cache.match(url))) missing.push(url);
                      }
                      return missing;
                    })(%s)
                    """ % (APP_CACHE, json.dumps(manifest))
                    missing = await evaluate(client, session_id, missing_expr, timeout_ms=10000) or []
                print("OFFLINE PREP DIAGNOSTIC", file=sys.stderr)
                print(f"cache entries so far: {cache_count}", file=sys.stderr)
                if missing:
                    print(f"missing manifest urls: {missing}", file=sys.stderr)
                print(body_text, file=sys.stderr)
                raise
            if not ready_text:
                raise RuntimeError("Offline app pack did not report ready")

            cache_count = await evaluate(
                client,
                session_id,
                f"caches.open('{APP_CACHE}').then(c => c.keys()).then(k => k.length)",
            )
            print(f"APP_CACHE entries: {cache_count}")

            print("Forcing Chromium offline")
            await client.send(
                "Network.emulateNetworkConditions",
                {"offline": True, "latency": 0, "downloadThroughput": 0, "uploadThroughput": 0},
                session_id=session_id,
            )

            failures: list[str] = []
            for route in args.routes:
                url = f"{base_url}{route}"
                try:
                    await navigate(client, session_id, url)
                    ok = await evaluate(
                        client,
                        session_id,
                        """
                        (() => {
                          const text = document.body.innerText || '';
                          return !!text &&
                            !text.includes('This site can’t be reached') &&
                            !text.includes('This site cannot be reached') &&
                            !text.includes('ERR_INTERNET_DISCONNECTED') &&
                            !text.includes('Application error') &&
                            !text.includes('Internal Server Error');
                        })()
                        """,
                    )
                    if not ok:
                        failures.append(f"{route}: rendered offline/browser error")
                    else:
                        print(f"offline route OK: {route}")
                except Exception as exc:  # noqa: BLE001
                    failures.append(f"{route}: {exc}")

            search_ok = await evaluate(
                client,
                session_id,
                "fetch('/search-index.json').then(r => r.ok).catch(() => false)",
            )
            if not search_ok:
                failures.append("/search-index.json: fetch failed offline")
            else:
                print("offline asset OK: /search-index.json")

            if failures:
                print("OFFLINE VERIFY FAIL", file=sys.stderr)
                for failure in failures:
                    print(f"- {failure}", file=sys.stderr)
                raise SystemExit(1)

            print("OFFLINE VERIFY PASS")
            print(f"routes checked: {len(args.routes)}")
            print("videos: opt-in only; app-pack verification intentionally excludes auto-video downloads")
    finally:
        with contextlib.suppress(Exception):
            proc.terminate()
            proc.wait(timeout=5)
        with contextlib.suppress(Exception):
            shutil.rmtree(profile)


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify true offline app behavior with Chromium/CDP")
    parser.add_argument("--base-url", default=os.environ.get("BASE_URL", "http://127.0.0.1:3000"))
    parser.add_argument("--chromium", default=os.environ.get("CHROMIUM", ""))
    parser.add_argument("--prepare-timeout", type=float, default=120.0)
    parser.add_argument("--route", dest="routes", action="append", help="Route to verify offline; repeatable")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    args.routes = args.routes or DEFAULT_ROUTES
    asyncio.run(verify(args))


if __name__ == "__main__":
    main()
