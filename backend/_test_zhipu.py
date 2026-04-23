import os
from dotenv import load_dotenv
import jwt
import time
import requests

load_dotenv()

api_key = os.getenv("ZHIPUAI_API_KEY") or os.getenv("ZHIPU_API_KEY")
parts = api_key.split(".")
api_id, api_secret = parts[0], parts[1]

now_ms = int(time.time() * 1000)
payload_jwt = {"api_key": api_id, "exp": now_ms + 300_000, "timestamp": now_ms}
token = jwt.encode(payload_jwt, api_secret, algorithm="HS256", headers={"alg": "HS256", "sign_type": "SIGN"})

models_to_try = ["glm-4", "glm-4-air", "glm-3-turbo", "chatglm_turbo"]

for m in models_to_try:
    print(f"Testing {m}...")
    resp = requests.post(
        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "model": m,
            "temperature": 0.2,
            "messages": [{"role": "user", "content": "Hello"}]
        },
        timeout=10
    )
    print("Status:", resp.status_code)
    try:
        print("Success:", resp.json()["choices"][0]["message"]["content"])
        break
    except:
        print("Failed:", resp.text)
        print("---")
