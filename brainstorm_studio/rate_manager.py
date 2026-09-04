import threading
import time
from typing import List, Dict

class GeminiRateManager:
    """
    Centralized rate manager for Gemini API models and per-key usage tracking.
    Manages model selection based on task type (Categorization vs AI Insights).
    """

    _lock = threading.Lock()
    _usage = {}  # {api_key: {"tokens": 0, "requests": 0, "last_reset": time.time()}}

    # Model Configuration Table
    # Format: {model_name: {rpm, tpm, rpd, task_types}}
    _MODEL_CONFIG = {
        # AI Insights Models (Priority Order)
        "gemini-2.5-pro": {
            "rpm": 2, "tpm": 125_000, "rpd": 50,
            "usage": ["ai insights"]
        },
        "gemini-flash-latest": {
            "rpm": 10, "tpm": 250_000, "rpd": 250,
            "usage": ["ai insights"]
        },

        # Categorization Models (Priority Order)
        "gemini-2.5-flash": {
            "rpm": 10, "tpm": 250_000, "rpd": 250,
            "usage": ["categorization"]
        },
        "gemini-2.5-flash-lite": {
            "rpm": 15, "tpm": 250_000, "rpd": 1_000,
            "usage": ["categorization"]
        },
        "gemini-flash-lite-latest": {
            "rpm": 15, "tpm": 250_000, "rpd": 1_000,
            "usage": ["categorization"]
        },
        "gemini-2.0-flash": {
            "rpm": 15, "tpm": 1_000_000, "rpd": 200,
            "usage": ["categorization"]
        },
        "gemini-2.0-flash-lite": {
            "rpm": 30, "tpm": 1_000_000, "rpd": 200,
            "usage": ["categorization"]
        },
        "gemma-3-4b-it": {
            "rpm": 30, "tpm": 15_000, "rpd": 14_400,
            "usage": ["categorization"]
        },
        "gemma-3n-e4b-it": {
            "rpm": 30, "tpm": 15_000, "rpd": 14_400,
            "usage": ["categorization"]
        }
    }

    # Pre-computed priority lists to ensure order is preserved
    _PRIORITY_LISTS = {
        "ai insights": [
            "gemini-2.5-pro",
            "gemini-flash-latest"
        ],
        "categorization": [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-flash-lite-latest",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemma-3-4b-it",
            "gemma-3n-e4b-it"
        ]
    }

    @classmethod
    def get_models_for_task(cls, task_type: str) -> List[str]:
        """
        Returns a list of model names appropriate for the given task type,
        ordered by priority.

        Args:
            task_type: 'categorization' or 'ai insights'

        Returns:
            List of model names strings.
        """
        # Normalize task type
        task_type = task_type.lower().strip()

        # Return specific list or empty list if not found
        return cls._PRIORITY_LISTS.get(task_type, [])

    @classmethod
    def get_models(cls) -> List[str]:
        """Legacy compatibility method."""
        # Defaults to categorization list if generic call
        return cls._PRIORITY_LISTS.get("categorization", [])

    @classmethod
    def get_limits(cls, model_name: str) -> Dict:
        """Fetches limit info for a given model."""
        return cls._MODEL_CONFIG.get(model_name, {"rpm": 10, "tpm": 250_000, "rpd": 250})

    # --- Usage Tracking ---

    @classmethod
    def register_usage(cls, api_key, tokens_used=0):
        with cls._lock:
            now = time.time()
            data = cls._usage.get(api_key, {"tokens": 0, "requests": 0, "last_reset": now})

            # Reset every minute
            if now - data["last_reset"] > 60:
                data = {"tokens": 0, "requests": 0, "last_reset": now}

            data["tokens"] += tokens_used
            data["requests"] += 1
            cls._usage[api_key] = data

    @classmethod
    def get_usage(cls, api_key):
        with cls._lock:
            return cls._usage.get(api_key, {"tokens": 0, "requests": 0, "last_reset": time.time()})

    @classmethod
    def check_availability(cls, model_name: str, api_key: str) -> bool:
        """
        Checks if the model is available for use based on local rate tracking.
        """
        usage = cls.get_usage(api_key)
        limits = cls.get_limits(model_name)

        # Check time window reset (handled in register_usage mostly, but good to check here)
        # We simulate the reset check here to be accurate before registration
        with cls._lock:
            now = time.time()
            if now - usage["last_reset"] > 60:
                # effectively reset
                usage = {"tokens": 0, "requests": 0, "last_reset": now}

        if usage["requests"] >= limits["rpm"]:
            return False

        # We could check TPM here too if we had accurate token counts before generation
        # but usually request count is the hard blocker for simple apps.
        return True
