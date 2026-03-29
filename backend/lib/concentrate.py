"""
Concentrate.ai API helper.
Drop-in replacement for OpenAI calls using the /v1/responses endpoint.
"""
import os
import json
import httpx

CONCENTRATE_BASE_URL = os.getenv("CONCENTRATE_BASE_URL", "https://api.concentrate.ai/v1")
CONCENTRATE_API_KEY = os.getenv("CONCENTRATE_API_KEY")
MODEL = "gpt-4o"


def _build_payload(system: str, messages: list, max_tokens: int = 500) -> dict:
    input_messages = [m for m in messages if m.get("role") != "system"]
    return {
        "model": MODEL,
        "instructions": system,
        "input": input_messages,
        "max_output_tokens": max_tokens,
    }


def _extract_text(data: dict) -> str:
    return data["output"][0]["content"][0]["text"]


def call_ai(system: str, messages: list, max_tokens: int = 500) -> str:
    """Synchronous call to concentrate.ai /responses endpoint."""
    response = httpx.post(
        f"{CONCENTRATE_BASE_URL}/responses",
        headers={
            "Authorization": f"Bearer {CONCENTRATE_API_KEY}",
            "Content-Type": "application/json",
        },
        json=_build_payload(system, messages, max_tokens),
        timeout=30.0,
    )
    response.raise_for_status()
    return _extract_text(response.json())


async def call_ai_async(system: str, messages: list, max_tokens: int = 500) -> str:
    """Async call to concentrate.ai /responses endpoint."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{CONCENTRATE_BASE_URL}/responses",
            headers={
                "Authorization": f"Bearer {CONCENTRATE_API_KEY}",
                "Content-Type": "application/json",
            },
            json=_build_payload(system, messages, max_tokens),
            timeout=30.0,
        )
        response.raise_for_status()
        return _extract_text(response.json())
