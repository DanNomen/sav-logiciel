import requests

CITY_COORDS = {
    "Antananarivo": {"lat": -18.8792, "lon": 47.5079},
    "Nosy Be": {"lat": -13.3131, "lon": 48.2662},
    "Tamatave": {"lat": -18.1492, "lon": 49.4023},
    "Tulear": {"lat": -23.3540, "lon": 43.6685},
    "Ambovombe": {"lat": -25.1784, "lon": 46.0874},
    "Fort Dauphin": {"lat": -25.0287, "lon": 46.9932}
}

def get_weather(city="Antananarivo"):
    try:
        coords = CITY_COORDS.get(city, CITY_COORDS["Antananarivo"])
        lat = coords["lat"]
        lon = coords["lon"]
        
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&timezone=auto"
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            current = data.get("current_weather", {})
            return {
                "temp": current.get("temperature"),
                "windspeed": current.get("windspeed"),
                "weathercode": current.get("weathercode"),
                "city": city
            }
        return None
    except Exception as e:
        print(f"Error fetching weather for {city}: {e}")
        return None
