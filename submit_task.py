import requests
import json

api_key = "b7aa7cee46af40269c2d8a7d036cbfb0"
image_url = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663201613123/zJcGWfKhgGrxPbNu.webp"
prompt = "Anime style, a young Tunisian boy with a friendly smile, wearing a traditional Tunisian vest (Jebba style), vibrant colors, Studio Ghibli aesthetic, Tunisian story theme, high quality, detailed background."

url = "https://api.nanobananaapi.ai/api/v1/nanobanana/generate"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}
data = {
    "prompt": prompt,
    "numImages": 1,
    "type": "IMAGETOIAMGE",
    "imageUrls": [image_url],
    "callBackUrl": "https://example.com/callback"  # Required but we will poll
}

response = requests.post(url, headers=headers, json=data)
print(response.text)
