import os
import requests
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
model   = os.getenv("GEMINI_MODEL", "gemini-3-pro-preview")

print(f"Key loaded: {'YES (' + api_key[:8] + '...)' if api_key else 'NO (None or empty)'}")


response = requests.post(
    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
    headers={"Content-Type": "application/json"},
    json={
        "contents": [{"parts": [{"text": "Say hello."}]}],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 100},
    },
    timeout=30,
)

print(f"Status: {response.status_code}")
data = response.json()
if response.ok:
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    print(f"Response: {text}")
else:
    print(f"Error: {data}")
