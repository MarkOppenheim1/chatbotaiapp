from pathlib import Path
import os
import yaml

CONFIG_PATH = Path(__file__).parent / "config" / "llm.yaml"

with open(CONFIG_PATH, "r") as f:
    _config = yaml.safe_load(f)

# ----- LLM -----
LLM_PROVIDER = os.getenv("LLM_PROVIDER", _config["llm"]["provider"])
LLM_MODEL = os.getenv("LLM_MODEL", _config["llm"]["model"])
LLM_TEMPERATURE = float(
    os.getenv("LLM_TEMPERATURE", _config["llm"]["temperature"])
)
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", _config["llm"]["max_tokens"]))
LLM_TOP_P = float(os.getenv("LLM_TOP_P", _config["llm"]["top_p"]))

# ------ Embedding ------
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_MODEL", _config["embedding"]["provider"])
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", _config["embedding"]["model"])

# ----- Retrieval -----
RETRIEVAL_K = int(
    os.getenv("RETRIEVAL_K", _config["retrieval"]["k"])
)