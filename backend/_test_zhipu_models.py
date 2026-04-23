import os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from dotenv import load_dotenv
import zhipuai

load_dotenv()
api_key = os.getenv("ZHIPUAI_API_KEY") or os.getenv("ZHIPU_API_KEY")
zhipuai.api_key = api_key

models = ["chatglm_turbo", "chatglm_pro", "chatglm_lite", "chatglm_std"]
for model in models:
    try:
        response = zhipuai.model_api.invoke(
            model=model,
            prompt=[{"role": "user", "content": "Say hello"}],
            temperature=0.2
        )
        code = response.get("code")
        msg = response.get('msg','')
        print(f"{model}: code={code}, msg={msg[:60]}")
        if code == 200:
            choices = response.get("data", {}).get("choices", [{}])
            content = choices[0].get('content', '') if choices else ''
            print(f"  OK: {content[:80]}")
    except Exception as e:
        print(f"{model}: ERROR {e}")
