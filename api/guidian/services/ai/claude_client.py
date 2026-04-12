import json
import re
from typing import Any

from anthropic import Anthropic

from guidian.core.config import settings


class ClaudeClient:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.ANTHROPIC_API_KEY
        self.model = model or settings.ANTHROPIC_MODEL
        self._client: Anthropic | None = None

    @property
    def client(self) -> Anthropic:
        if self._client is None:
            if not self.api_key:
                raise RuntimeError("ANTHROPIC_API_KEY not configured")
            self._client = Anthropic(api_key=self.api_key)
        return self._client

    def generate_json(self, system: str, user: str, max_tokens: int = 16000) -> dict[str, Any]:
        """Synchronous call — used from Celery worker threads."""
        message = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(
            block.text for block in message.content if getattr(block, "type", None) == "text"
        ).strip()
        return _extract_json(text)


def _extract_json(text: str) -> dict[str, Any]:
    # Allow the model to wrap in fences despite instructions
    fence = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    # Fall back to first {...} block
    if not text.lstrip().startswith("{"):
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            raise ValueError("Claude response did not contain JSON")
        text = text[start : end + 1]
    return json.loads(text)
