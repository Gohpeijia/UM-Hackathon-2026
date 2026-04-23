import os
from dotenv import load_dotenv
import zhipuai

load_dotenv()
api_key = os.getenv("ZHIPUAI_API_KEY") or os.getenv("ZHIPU_API_KEY")
zhipuai.api_key = api_key

try:
    response = zhipuai.model_api.invoke(
        model="glm-5.1",
        prompt=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Say hello in english"}
        ],
        temperature=0.2
    )
    print("Response code:", response.get("code"))
    print("Response data:", response.get("data", {}).get("choices", [{}])[0].get("content"))
except Exception as e:
    print("Error:", e)
