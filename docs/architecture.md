# Architecture decisions

## ADR-001: Local inference
All AI inference is local. Applications call the internal AI Core, which calls vLLM. No external AI API is part of the runtime path.

## ADR-002: Provider abstraction
The application depends on `LLMProvider`, not directly on Qwen or vLLM. This makes model replacement possible without changing business applications.

## ADR-003: RAG first
Enterprise knowledge is retrieved from Qdrant and cited. The model is not treated as the authoritative source of company policy.

## ADR-004: Human approval for write tools
Future SAP/HR/IT write actions must be explicit tools with RBAC and approval policies. The initial release is read-oriented.

## ADR-005: Docker first, Kubernetes later
The service boundaries are Kubernetes-compatible, but initial operations use Docker Compose to reduce complexity.
