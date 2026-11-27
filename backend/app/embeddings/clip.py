"""Optional local CLIP adapter. Imports torch only when the offline job needs it."""

from typing import Any

from app.embeddings.spec import DIMENSIONS, MODEL_NAME, MODEL_REVISION


def chunk_tokens(tokenizer, name, statements, max_length=77):
    """Pack complete token sequences, splitting oversized fields without truncation."""
    prefix = tokenizer.encode(f"{name}. ", add_special_tokens=False, verbose=False)
    if len(prefix) >= max_length - 2:
        raise ValueError("Product name exceeds CLIP context; cannot silently truncate identity")
    capacity = max_length - 2 - len(prefix)
    payload = []
    for statement in statements:
        payload.extend(tokenizer.encode(statement + " ", add_special_tokens=False, verbose=False))
    return [tokenizer.build_inputs_with_special_tokens(prefix + payload[start:start + capacity])
            for start in range(0, max(1, len(payload)), capacity)]


class ClipEncoder:
    def __init__(self, cache_dir, device="auto", batch_size=32, local_files_only=False):
        import torch
        from transformers import CLIPImageProcessor, CLIPModel, CLIPTokenizerFast

        if batch_size < 1 or batch_size > 128:
            raise ValueError("Encoder batch size must be 1–128")
        if device == "auto":
            device = "mps" if torch.backends.mps.is_available() else "cpu"
        if device not in {"mps", "cpu", "cuda"}:
            raise ValueError("Unknown device")
        torch.set_num_threads(4)
        self.device = device
        self.batch_size = batch_size
        options: dict[str, Any] = dict(revision=MODEL_REVISION, cache_dir=str(cache_dir), token=False,
                                       trust_remote_code=False, local_files_only=local_files_only)
        self.tokenizer = CLIPTokenizerFast.from_pretrained(MODEL_NAME, **options)
        self.processor = CLIPImageProcessor.from_pretrained(MODEL_NAME, **options)
        self.model = CLIPModel.from_pretrained(MODEL_NAME, **options, use_safetensors=False)
        if self.model.config.projection_dim != DIMENSIONS or self.model.config.text_config.max_position_embeddings != 77:
            raise ValueError("Unexpected CLIP projection/context configuration")
        self.model.to(device).eval()

    def text(self, document):
        import torch

        chunks = chunk_tokens(self.tokenizer, document.name, document.statements)
        features = []
        with torch.inference_mode():
            for start in range(0, len(chunks), self.batch_size):
                batch = chunks[start:start + self.batch_size]
                inputs = self.tokenizer.pad({"input_ids": batch}, padding=True, return_tensors="pt")
                inputs = {key: value.to(self.device) for key, value in inputs.items()}
                encoded = self.model.get_text_features(**inputs).float()
                features.append(torch.nn.functional.normalize(encoded, dim=-1).cpu())
        pooled = torch.cat(features).mean(dim=0)
        vector = torch.nn.functional.normalize(pooled, dim=0).tolist()
        return vector, dict(chunks=[self.tokenizer.decode(c[1:-1]) for c in chunks],
                            token_counts=[len(c) for c in chunks], chunk_count=len(chunks),
                            pooling="L2(normalized chunk feature mean)")

    def images(self, paths):
        import torch
        from PIL import Image

        result = []
        with torch.inference_mode():
            for start in range(0, len(paths), self.batch_size):
                batch = []
                for path in paths[start:start + self.batch_size]:
                    with Image.open(path) as image:
                        batch.append(image.convert("RGB"))
                try:
                    inputs = self.processor(images=batch, return_tensors="pt")
                    encoded = self.model.get_image_features(pixel_values=inputs["pixel_values"].to(self.device))
                    result.extend(torch.nn.functional.normalize(encoded.float(), dim=-1).cpu().tolist())
                finally:
                    for converted in batch:
                        converted.close()
        return result
