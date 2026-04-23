import re

with open('c:/Users/User/Desktop/UM-Hackathon-2026/backend/vision_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

endpoints = re.findall(r'@app\.(?:post|get)\(\"([^\"]+)\"\)', content)
for ep in endpoints:
    print(ep)
