try:
    import requests
    print("Requests OK")
except ImportError as e:
    print(f"Error requests: {e}")

try:
    from dotenv import load_dotenv
    print("Dotenv OK")
except ImportError as e:
    print(f"Error dotenv: {e}")

try:
    from api_vrm import VictronVRM
    print("API VRM OK")
except Exception as e:
    print(f"Error api_vrm: {e}")
