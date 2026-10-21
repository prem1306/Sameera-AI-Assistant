"""One-shot CPU speech worker. Only local files are accepted; no HF downloads."""
import os
os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1", DO_NOT_TRACK="1")
import sys, json, base64

def main():
    request = json.load(sys.stdin)
    import torch
    import numpy as np
    from transformers import AutoTokenizer
    from parler_tts import ParlerTTSForConditionalGeneration
    torch.set_num_threads(4)
    root = request["root"]
    model = ParlerTTSForConditionalGeneration.from_pretrained(os.path.join(root, "indic"), local_files_only=True).to("cpu")
    tokenizer = AutoTokenizer.from_pretrained(os.path.join(root, "indic"), local_files_only=True)
    description_tokenizer = AutoTokenizer.from_pretrained(os.path.join(root, "description"), local_files_only=True)
    language = request.get("language", "english").split("-")[0]
    if language == "bilingual": language = "telugu"
    male = request.get("persona") == "butler"
    speakers = {"telugu": ("Lalitha", "Prakash"), "tamil": ("Jaya", "Prakash"), "kannada": ("Anu", "Suresh"), "malayalam": ("Anjali", "Harish"), "hindi": ("Divya", "Rohit"), "english": ("Mary", "Thoma")}
    speaker = speakers.get(language, speakers["english"])[int(male)]
    caption = f"{speaker} speaks in {language} with a {'male, low-pitched, calm and professional' if male else 'female, warm and conversational'} voice, at a moderate pace. Very clear audio, close recording, no background noise."
    description = description_tokenizer(caption, return_tensors="pt")
    prompt = tokenizer(request["text"][:1500], return_tensors="pt")
    with torch.inference_mode():
        generated = model.generate(input_ids=description.input_ids, attention_mask=description.attention_mask, prompt_input_ids=prompt.input_ids, prompt_attention_mask=prompt.attention_mask, max_new_tokens=1800)
    audio = generated.cpu().numpy().squeeze()
    rate = model.config.sampling_rate
    samples = int(len(audio) * 24000 / rate)
    audio = np.interp(np.linspace(0, len(audio) - 1, samples), np.arange(len(audio)), audio)
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes()
    print(json.dumps({"audio": base64.b64encode(pcm).decode("ascii"), "sampleRate": 24000}))

if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Never print input text, local paths or library exceptions into desktop logs.
        print(json.dumps({"error": "Local speech failed. Check the installed model pack."}))
        sys.exit(1)
