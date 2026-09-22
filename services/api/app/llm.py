import httpx
from .config import get_settings

class LLMProvider:
    async def chat(self, messages: list[dict], temperature: float = 0.2, max_tokens: int = 1200) -> str:
        raise NotImplementedError

class MockLLM(LLMProvider):
    async def chat(self, messages, temperature=0.2, max_tokens=1200):
        user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        return f"[MODE MOCK] J’ai reçu votre demande : {user}\n\nPour activer l’intelligence locale, démarrez vLLM et définissez LLM_MODE=vllm."

class VLLMProvider(LLMProvider):
    def __init__(self):
        s = get_settings(); self.base_url=s.llm_base_url.rstrip('/'); self.api_key=s.llm_api_key; self.model=s.model_name
    async def chat(self, messages, temperature=0.2, max_tokens=1200):
        payload={"model": self.model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
        headers={"Authorization": f"Bearer {self.api_key}"}
        async with httpx.AsyncClient(timeout=180) as client:
            r=await client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

def get_llm() -> LLMProvider:
    return VLLMProvider() if get_settings().llm_mode.lower()=="vllm" else MockLLM()
