# Enterprise AI — Sovereign Employee Assistant v1

A self-hosted enterprise AI platform designed for an employee assistant with text + voice conversations, enterprise RAG, memory, RBAC, audit and local inference. No external AI API is required.

## V1 stack

- FastAPI — API gateway + assistant service
- vLLM — local LLM inference (OpenAI-compatible internal endpoint)
- Qwen3-8B by default; change `MODEL_NAME` for a larger local model
- Qdrant — vector search
- PostgreSQL — users, conversations, memory, audit
- MinIO — document/object storage
- Redis — background job queue/cache
- Keycloak — production identity provider (dev mode is available)
- faster-whisper — local speech-to-text
- Piper — local text-to-speech (optional but supported)
- React + Vite — web UI
- Docker Compose — initial deployment

## Requirements

- Linux server recommended for GPU inference
- Docker + Docker Compose
- NVIDIA Container Toolkit for GPU mode
- 24 GB VRAM minimum for the default Qwen3-8B setup; 48 GB is recommended for production headroom
- 64 GB RAM minimum for development; 128 GB recommended for the target V1

## Quick start

1. Copy `.env.example` to `.env`.
2. For CPU-only local inference, set `LLM_MODE=ollama` and use the `qwen3:1.7b` model.
3. For local GPU inference, set `LLM_MODE=vllm`, install NVIDIA Container Toolkit, and start with the GPU compose file.
4. Start:

```bash
docker compose --env-file .env -f docker-compose.yml up -d --build
```

For GPU:

```bash
docker compose --env-file .env --profile gpu -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

For CPU fallback with Ollama:

```bash
docker compose --env-file .env --profile cpu up -d --build
docker compose --env-file .env exec ollama ollama pull qwen3:1.7b
```

5. Open the web application at `http://localhost:5173`.
6. API docs: `http://localhost:8000/docs`.
7. Qdrant dashboard: `http://localhost:6333/dashboard`.
8. MinIO: `http://localhost:9001`.
9. Keycloak: `http://localhost:8080`.

## First document

Use the UI upload panel or call:

```bash
curl -X POST http://localhost:8000/api/v1/documents \
  -F 'file=@./docs/example.txt'
```

Then ask a question about the document.

## API

- `GET /api/v1/health`
- `POST /api/v1/chat`
- `GET /api/v1/conversations`
- `POST /api/v1/documents`
- `GET /api/v1/documents`
- `POST /api/v1/voice/transcribe`
- `POST /api/v1/voice/synthesize`
- `GET /api/v1/me`

## Architecture

```text
Browser / Mobile
       |
       v
   FastAPI Gateway
       |
   +---+---------------------+
   |                         |
 Assistant                 Voice
   |                         |
   +----------+--------------+
              |
        AI Provider
              |
          vLLM / Mock
              |
       Qwen local model

Assistant -> RAG -> Embeddings -> Qdrant
Assistant -> Memory -> PostgreSQL
Documents -> MinIO + PostgreSQL + Qdrant
Identity -> Keycloak (production)
```

## Security notes

This repository deliberately defaults to `AUTH_MODE=dev` for local development. Production deployments must use Keycloak/OIDC, TLS, private network exposure for databases, secret management, backups, and explicit tool permissions. Do not expose vLLM, PostgreSQL, Redis, Qdrant or MinIO directly to the public internet.

## Roadmap

V1.1: streaming chat, true real-time voice/WebSocket, reranker, richer document parsers.
V1.2: employee directory/HR connectors, IT service tools, SAP read-only connector.
V2: approval workflows, MCP tool servers, multi-agent orchestration, HA and Kubernetes.
