import requests
import time
import json

api_key = "b7aa7cee46af40269c2d8a7d036cbfb0"
task_id = "f91427f6923fb64ced8198b0b4c7bdd0"
url = f"https://api.nanobananaapi.ai/api/v1/nanobanana/record-info?taskId={task_id}"
headers = {
    "Authorization": f"Bearer {api_key}"
}

print(f"Polling task {task_id}...")
for i in range(10):
    response = requests.get(url, headers=headers)
    result = response.json()
    print(f"Attempt {i+1}: {result.get('msg')}")
    
    if result.get("code") == 200:
        data = result.get("data", {})
        success_flag = data.get("successFlag")
        if success_flag == 1:
            print("Success!")
            print(json.dumps(data, indent=2))
            break
        elif success_flag in [2, 3]:
            print(f"Failed with flag {success_flag}: {data.get('errorMessage')}")
            break
    
    time.sleep(10)
else:
    print("Polling timed out.")
