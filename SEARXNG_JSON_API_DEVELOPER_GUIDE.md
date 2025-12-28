# SearXNG JSON API – Developer Guide

This project replaces a “Google Search Console / Google Search API” style dependency with a **self-hosted SearXNG JSON API**.

---

## 0) Start / Stop SearXNG (Docker)

These commands are written for this repo layout:

- Config directory: `./searxng/config/` `(/home/roshaan/Desktop/searxng/searxng/config/settings.yml)` (contains `settings.yml`)

- Cache/data directory: `./searxng/data/`
- Container name: `searxng`
- Host port: `8888` (mapped to container port `8080`)

### 0.1 Start

```bash
docker run --name searxng -d \
  -p 8888:8080 \
  -v "./searxng/config/:/etc/searxng/" \
  -v "./searxng/data/:/var/cache/searxng/" \
  docker.io/searxng/searxng:latest
```

### 0.2 Restart (after editing `settings.yml`)

```bash
docker restart searxng
```

### 0.3 Stop

```bash
docker stop searxng
```

### 0.4 Remove container (keeps your config/data on disk)

```bash
docker rm -f searxng
```

### 0.5 Check status

```bash
docker ps --filter name=searxng
```

---

- **Base URL (local):** `http://127.0.0.1:8888`
- **Important:** This instance is configured as **JSON-only** (`search.formats: [json]`).
  - Opening `/` in a browser will return **403 Forbidden** (expected).
  - Limiter is disabled and Valkey/Redis is off in the current config.

---

## 1) Endpoints

### 1.1 Search

- **Method:** `GET` (also supports `POST` in SearXNG generally, but use `GET` for simplicity)
- **Path:** `/search`

#### Required query parameters

- `q`: your search query
- `format=json`: force JSON output

Example:

```text
http://127.0.0.1:8888/search?q=test&format=json
```

### 1.2 Instance config (debugging)

- **Method:** `GET`
- **Path:** `/config`

Example:

```text
http://127.0.0.1:8888/config
```

Use this to confirm:

- which engines are enabled
- which categories exist
- instance version and settings

---

## 2) Recommended request patterns (speed + low load)

Always send `categories=...` so the server queries only the minimum engine set.

### 2.1 General / websites

```text
/search?q=linux&format=json&categories=general,web
```

### 2.2 Images

```text
/search?q=cats&format=json&categories=images
```

### 2.3 Videos

```text
/search?q=linux%20tutorial&format=json&categories=videos
```

### 2.4 (Optional) Force a specific engine allowlist per request

Even though the instance is already restricted, you can still explicitly enforce engines:

```text
/search?q=linux&format=json&categories=general,web&engines=google,startpage,brave,wikipedia,wikidata
```

---

## 3) Enabled engines (current instance configuration)

From `/config`, only these are enabled:

### 3.1 General/Web

- `startpage`
- `brave`
- `wikipedia`
- `wikidata`

### 3.2 Images

- `startpage images`
- `brave.images`
- `wikicommons.images`

### 3.3 Videos

- `brave.videos`

---

## 4) JSON response: what you get back

The JSON response is a single object with a predictable top-level structure.

### 4.1 Top-level keys you should handle

Common keys you will see:

- `query` *(string)*
- `results` *(array)*
- `number_of_results` *(int, may be estimated)*
- `answers` *(array, optional)*
- `infoboxes` *(array, optional)*
- `suggestions` *(array, optional)*
- `unresponsive_engines` *(array)*

#### `unresponsive_engines` is important

This tells you which engines failed for that request, e.g.

- timeouts
- CAPTCHA
- temporary blocks

Your code must tolerate partial results.

### 4.2 `results[]` item shape (practical schema)

Each element in `results` is an object. Fields vary by category/engine, but these are common:

- `title` *(string)*
- `url` *(string)*
- `content` *(string snippet)*
- `engine` *(string; the producing engine)*
- `category` *(string; e.g. `general`, `images`, `videos`)*

Often for image/video results:

- `img_src` *(string URL)*
- `thumbnail` *(string URL)*

---

## 5) Parsing strategy (recommended)

### 5.1 Normalize results to a stable internal schema

Do **not** expose the raw SearXNG schema directly to your application.

Normalize every result into your own schema:

```json
{
  "title": "...",
  "url": "...",
  "snippet": "...",
  "engine": "...",
  "category": "...",
  "image": "..."
}
```

Rules:

- **title/url**: required, skip any result missing `url`
- **snippet**: map from `content`
- **image**: map from `img_src` if present

### 5.2 Always record engine failures

Store `unresponsive_engines` for debugging and monitoring.

---

## 6) Examples

## 6.1 curl + jq

General/Web (show first 5):

```bash
curl -sS \
  'http://127.0.0.1:8888/search?q=linux&format=json&categories=general,web' \
  | jq '.results[:5] | map({title,url,engine,category})'
```

Images:

```bash
curl -sS \
  'http://127.0.0.1:8888/search?q=cats&format=json&categories=images' \
  | jq '.results[:10] | map({title,url,img_src,engine,category})'
```

## 6.2 Python (requests)

```python
import requests

BASE = "http://127.0.0.1:8888"

def searxng_search(query: str, categories: str):
    r = requests.get(
        f"{BASE}/search",
        params={
            "q": query,
            "format": "json",
            "categories": categories,
        },
        timeout=20,
    )
    r.raise_for_status()
    data = r.json()

    # Always inspect failures
    unresp = data.get("unresponsive_engines") or []

    normalized = []
    for item in data.get("results", []) or []:
        url = item.get("url")
        if not url:
            continue
        normalized.append(
            {
                "title": item.get("title") or "",
                "url": url,
                "snippet": item.get("content") or "",
                "engine": item.get("engine") or "",
                "category": item.get("category") or "",
                "image": item.get("img_src") or "",
            }
        )

    return {
        "query": data.get("query") or query,
        "results": normalized,
        "unresponsive_engines": unresp,
        "number_of_results": data.get("number_of_results"),
    }

print(searxng_search("linux", "general,web"))
```

## 6.3 Node.js (fetch)

```js
const BASE = "http://127.0.0.1:8888";

async function searxngSearch(query, categories) {
  const url = new URL("/search", BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("categories", categories);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  const normalized = (data.results || [])
    .filter(r => r.url)
    .map(r => ({
      title: r.title ?? "",
      url: r.url,
      snippet: r.content ?? "",
      engine: r.engine ?? "",
      category: r.category ?? "",
      image: r.img_src ?? "",
    }));

  return {
    query: data.query ?? query,
    results: normalized,
    unresponsive_engines: data.unresponsive_engines ?? [],
    number_of_results: data.number_of_results,
  };
}

searxngSearch("linux", "general,web").then(console.log).catch(console.error);
```

---

## 7) Error handling notes

- **403 Forbidden in browser:** expected if you browse `/` because `html` is disabled.
- **CAPTCHA / timeouts:** check `unresponsive_engines`.
- **Retries:** client-side retries should be limited; prefer changing category/engine sets if a specific engine is blocked.

---

## 8) Quick “health check” calls

- Config:

```bash
curl -sS 'http://127.0.0.1:8888/config' | head
```

- Search:

```bash
curl -sS 'http://127.0.0.1:8888/search?q=test&format=json&categories=general,web' | head
```
