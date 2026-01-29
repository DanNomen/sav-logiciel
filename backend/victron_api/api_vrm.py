import os
import requests
import json
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from the .env file in the same directory
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

VICTRON_API_TOKEN = os.getenv("VICTRON_API_TOKEN")
VICTRON_API_URL = os.getenv("VICTRON_API_URL", "https://vrmapi.victronenergy.com/v2")

class VictronVRM:
    """
    Class to interact with the Victron VRM API.
    """
    def __init__(self, token=None):
        self.token = token or VICTRON_API_TOKEN
        if not self.token:
            print("Warning: VICTRON_API_TOKEN not found in environment variables.")
        
        self.headers = {"X-Authorization": f"Token {self.token}",
                        "Content-Type": "application/json"}
    
    def get_user_id(self):
        """
        Fetch the current authenticated user's ID.
        """
        if not self.token:
            return None
            
        url = f"{VICTRON_API_URL}/users/me"
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            if response.status_code == 200:
                user_data = response.json()
                # Try getting ID from 'user' object first, then top level
                user_id = user_data.get("user", {}).get("id") or user_data.get("idUser")
                return user_id
            else:
                print(f"Error fetching user ID at {url}: {response.status_code} - {response.text}")
                return None
        except requests.exceptions.RequestException as e:
            print(f"Network error fetching user ID: {e}")
            return None

    def get_all_installations(self, user_id=None):
        """
        Fetch all installations visible to the user.
        If user_id is not provided, it fetches it first.
        """
        if not user_id:
            user_id = self.get_user_id()
            if not user_id:
                return []
        
        url = f"{VICTRON_API_URL}/users/{user_id}/installations?extended=1"
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                records = data.get("records", [])
                return records
            else:
                print(f"Error fetching installations at {url}: {response.status_code} - {response.text}")
                return []
        except requests.exceptions.RequestException as e:
            print(f"Network error fetching installations: {e}")
            return []

    def format_installation_for_system_form(self, installation):
        """
        Map VRM installation data to the System model structure.
        """
        # Extract relevant fields
        # VRM 'sys_created' is usually a unix timestamp
        created_timestamp = installation.get("sys_created")
        commissioning_date = datetime.now().strftime("%Y-%m-%d")
        if created_timestamp:
            try:
                # Handle timestamp if it's int or float
                commissioning_date = datetime.fromtimestamp(int(created_timestamp)).strftime("%Y-%m-%d")
            except Exception:
                pass
        
        # VRM timezone -> Location (approximation)
        location = installation.get("timezone", "Unknown")
        
        # Constructs the dictionary matching the System schema in main.py
        system_data = {
            "monitoring_name": installation.get("name", "Unknown System"),
            "victron_site_id": str(installation.get("idSite")),
            "location": location,
            "commissioning_date": commissioning_date,
            "engineer": "Non spécifié",
            "agency": "Non spécifié",
            "installation_type": "Solaire",
            "power_va": 0,
            "contract_type": "Maintenance",
            "contract_duration_months": 12,
            "client_id": "unknown_client_id", # Placeholder, needs manual linking
            "paid": False,
            "comments": f"Imported via VRM API. Access Level: {installation.get('accessLevel', 'Unknown')}",
            
            # Initialize optional counts
            "pv_count": 0, 
            "battery_count": 0,
            "inverter_charger_count": 0,
            "pv_inverter_count": 0,
            "solar_regulator_count": 0
        }
        
        return system_data

def collect_installations():
    """
    Main execution function.
    """
    print("Initializing Victron VRM Client...")
    vrm = VictronVRM()
    
    print("Fetching installations...")
    installations = vrm.get_all_installations()
    
    if not installations:
        print("No installations found.")
        return []

    print(f"Found {len(installations)} installations.")
    
    formatted_systems = []
    for inst in installations:
        sys_data = vrm.format_installation_for_system_form(inst)
        formatted_systems.append(sys_data)
        
        print(f"\n[+] Processed System: {sys_data['monitoring_name']}")
        print(f"    ID: {sys_data['victron_site_id']}")
        print(f"    Date: {sys_data['commissioning_date']}")
    
    return formatted_systems

if __name__ == "__main__":
    collect_installations()
