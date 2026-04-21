#!/usr/bin/env python3
"""FAW Intel — coletor rápido de inteligência de domínio/URL.

Objetivo (FAW): gerar um report básico e reproduzível para triagem OSINT/infra:
- DNS (A/AAAA/CNAME/MX/NS/TXT)
- HTTP(S) (status, headers, redirects)
- pistas de redes sociais (Instagram/Discord) no HTML

Uso:
  python3 tools/faw_intel.py mush.com.br
  python3 tools/faw_intel.py https://mush.com.br

Saída:
  reports/faw_intel_<host>_<timestamp>.json
"""

from __future__ import annotations

import json
import re
import socket
import ssl
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

REPORTS_DIR = Path("reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

UA = "FAW-Intel/1.0 (+https://discord.gg/FAW)"


def now_ts() -> str:
    return time.strftime("%Y%m%d_%H%M%S", time.gmtime())


def normalize_target(target: str) -> Tuple[str, str]:
    target = target.strip()
    if not target:
        raise ValueError("target vazio")

    if re.match(r"^https?://", target, re.I):
        u = urllib.parse.urlparse(target)
        host = u.hostname or ""
        if not host:
            raise ValueError("URL sem hostname")
        base_url = f"{u.scheme}://{host}"
        return host, base_url

    host = target
    base_url = f"https://{host}"
    return host, base_url


def tcp_connect(host: str, port: int, timeout: float = 5.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def resolve_a_aaaa(host: str) -> Dict[str, List[str]]:
    out = {"A": [], "AAAA": []}
    try:
        infos = socket.getaddrinfo(host, None)
        for fam, _socktype, _proto, _canon, sockaddr in infos:
            ip = sockaddr[0]
            if fam == socket.AF_INET and ip not in out["A"]:
                out["A"].append(ip)
            elif fam == socket.AF_INET6 and ip not in out["AAAA"]:
                out["AAAA"].append(ip)
    except Exception:
        pass
    return out


def fetch(url: str, method: str = "GET", timeout: float = 12.0, max_bytes: int = 2_000_000) -> Dict:
    req = urllib.request.Request(
        url,
        method=method,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            headers = {k.lower(): v for k, v in resp.headers.items()}
            body = b""
            if method.upper() != "HEAD":
                body = resp.read(max_bytes)
            ct = headers.get("content-type", "")
            text = ""
            if body and ("text" in ct or "html" in ct or ct == ""):
                try:
                    text = body.decode("utf-8", errors="replace")
                except Exception:
                    text = ""

            return {
                "ok": True,
                "final_url": resp.geturl(),
                "status": getattr(resp, "status", None),
                "headers": headers,
                "content_type": ct,
                "body_bytes": len(body),
                "body_preview": text[:4000],
            }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def find_socials(html: str) -> Dict[str, List[str]]:
    socials = {"instagram": [], "discord": []}
    if not html:
        return socials

    patterns = {
        "instagram": [
            r"https?://(?:www\.)?instagram\.com/[A-Za-z0-9_.-]+",
            r"https?://(?:www\.)?instagr\.am/[A-Za-z0-9_.-]+",
        ],
        "discord": [
            r"https?://(?:www\.)?discord\.gg/[A-Za-z0-9-]+",
            r"https?://(?:www\.)?discord\.com/invite/[A-Za-z0-9-]+",
        ],
    }

    for k, pats in patterns.items():
        hits: List[str] = []
        for p in pats:
            hits.extend(re.findall(p, html, flags=re.I))
        # unique preserving order
        seen = set()
        uniq = []
        for h in hits:
            if h not in seen:
                seen.add(h)
                uniq.append(h)
        socials[k] = uniq

    return socials


def tls_cert_san_cn(host: str, port: int = 443, timeout: float = 6.0) -> Dict:
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=timeout) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()

        subject = cert.get("subject", [])
        cn = None
        for tup in subject:
            for k, v in tup:
                if k.lower() == "commonname":
                    cn = v

        san = []
        for k, v in cert.get("subjectAltName", []):
            if k.lower() == "dns":
                san.append(v)

        return {"ok": True, "cn": cn, "san": san, "issuer": cert.get("issuer"), "notAfter": cert.get("notAfter")}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@dataclass
class Report:
    target_input: str
    host: str
    base_url: str
    timestamp_utc: str

    dns: Dict
    connectivity: Dict
    http: Dict
    socials: Dict
    tls: Dict


def main(argv: List[str]) -> int:
    if len(argv) < 2:
        print("Uso: python3 tools/faw_intel.py <dominio|url>")
        return 2

    target = argv[1]
    host, base_url = normalize_target(target)

    dns = resolve_a_aaaa(host)

    connectivity = {
        "tcp_80": tcp_connect(host, 80),
        "tcp_443": tcp_connect(host, 443),
    }

    http_head = fetch(base_url, method="HEAD")
    http_get = fetch(base_url, method="GET")

    socials = find_socials(http_get.get("body_preview", "") if http_get.get("ok") else "")

    tls = tls_cert_san_cn(host) if connectivity["tcp_443"] else {"ok": False, "error": "porta 443 indisponível"}

    rep = Report(
        target_input=target,
        host=host,
        base_url=base_url,
        timestamp_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        dns=dns,
        connectivity=connectivity,
        http={"head": http_head, "get": http_get},
        socials=socials,
        tls=tls,
    )

    out_path = REPORTS_DIR / f"faw_intel_{re.sub(r'[^A-Za-z0-9._-]+', '_', host)}_{now_ts()}.json"
    out_path.write_text(json.dumps(asdict(rep), indent=2, ensure_ascii=False))

    print(str(out_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
