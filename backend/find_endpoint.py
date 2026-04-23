import re

with open('c:/Users/User/Desktop/UM-Hackathon-2026/backend/vision_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('"/boardroom/debate"')
if idx != -1:
    start_idx = content.rfind('@app', 0, idx)
    print(content[start_idx:start_idx+1500])
else:
    print("Not found")
