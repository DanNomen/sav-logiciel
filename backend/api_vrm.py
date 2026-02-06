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
            response = requests.get(url, headers=self.headers, timeout=30)
            if response.status_code == 200:
                user_data = response.json()
                # Try getting ID from 'user' object first, then top level
                user_id = user_data.get("user", {}).get("id") or user_data.get("idUser")
                if user_id:
                    print(f"[DEBUG] Successfully retrieved User ID: {user_id}")
                else:
                    print(f"[DEBUG] User ID not found in response: {user_data}")
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
            response = requests.get(url, headers=self.headers, timeout=30)
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

    def get_system_devices(self, id_site):
        """
        Fetch the list of devices for a specific site using the system-overview endpoint.
        Returns a list of device-attribute records.
        """
        url = f"{VICTRON_API_URL}/installations/{id_site}/system-overview"
        try:
            response = requests.get(url, headers=self.headers, timeout=15)
            if response.status_code == 200:
                data = response.json()
                records = data.get("records")
                if isinstance(records, list):
                    return records
                if isinstance(records, dict):
                    # Handle nested structure if it exists
                    return records.get(str(id_site)) or records.get(id_site) or records.get("devices") or []
                return []
            else:
                print(f"  [!] Error {response.status_code} fetching overview for {id_site}")
                return []
        except Exception as e:
            print(f"  [!] Exception fetching overview for {id_site}: {e}")
            return []

    def enrich_system_with_devices(self, system_data, id_site):
        """
        Fetch devices and update counts/types in system_data.
        """
        records = self.get_system_devices(id_site)
        if not records:
            return system_data
            
        # Group records by (Name, Instance) to identify unique devices
        unique_devices = {}
        for r in records:
            # The field is usually 'name' in system-overview, but some diagnostic endpoints use 'Device'
            dev_name = r.get("name") or r.get("Device")
            instance = r.get("instance")
            
            if dev_name and instance is not None:
                key = f"{dev_name}_{instance}"
                if key not in unique_devices:
                    unique_devices[key] = {
                        "name": dev_name,
                        "instance": instance,
                        "productName": r.get("productName") or dev_name
                    }
        
        device_items = list(unique_devices.values())
        
        # Identify device types based on their names and product names
        solar_chargers = [d for d in device_items if any(x in d["name"] or x in d["productName"] for x in ["Solar Charger", "SmartSolar", "BlueSolar", "MPPT"])]
        inverters = [d for d in device_items if any(x in d["name"] or x in d["productName"] for x in ["VE.Bus System", "Inverter", "MultiPlus", "Quattro", "Phoenix"])]
        batteries = [d for d in device_items if any(x in d["name"] or x in d["productName"] for x in ["Battery", "SmartShunt", "BMV", "Lynx"])]
        pv_inverters = [d for d in device_items if any(x in d["name"] or x in d["productName"] for x in ["PV Inverter", "Fronius", "SMA", "ABB"])]
        
        # Update counts
        # Map Solar Chargers to both 'solar_regulator' AND 'pv' fields to satisfy UI binding
        count_sc = len(solar_chargers)
        system_data["solar_regulator_count"] = count_sc
        system_data["pv_count"] = count_sc # Often used for MPPTs in the UI
        
        system_data["inverter_charger_count"] = len(inverters)
        system_data["battery_count"] = len(batteries)
        system_data["pv_inverter_count"] = len(pv_inverters)
        
        # Update types
        if solar_chargers:
            sc_type = solar_chargers[0].get("productName")
            system_data["solar_regulator_type"] = sc_type
            system_data["pv_type"] = sc_type
            
        if inverters:
            inverter_name = inverters[0].get("productName", "")
            system_data["inverter_charger_type"] = inverter_name
            # Try to extract power (e.g. 48/5000/70 -> 5000)
            import re
            match = re.search(r'/(\d+)/', inverter_name)
            if match:
                try:
                    system_data["power_va"] = int(match.group(1))
                except Exception:
                    pass
            elif "10000" in inverter_name: # Handle case like Quattro 48/10000
                system_data["power_va"] = 10000
                    
        if batteries:
            system_data["battery_type"] = batteries[0].get("productName")
            
        if pv_inverters:
            system_data["pv_inverter_type"] = pv_inverters[0].get("productName")
            
        return system_data

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

def collect_installations(fetch_details=True, limit=None):
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

    # Limit logic removed to fetch all systems

    print(f"Processing {len(installations)} installations...")
    
    formatted_systems = []
    for inst in installations:
        site_id = str(inst.get("idSite"))
        name = inst.get("name", "Unknown")
        sys_data = vrm.format_installation_for_system_form(inst)
        
        if fetch_details and site_id:
            print(f"  -> Fetching devices for {name} (ID: {site_id})...")
            sys_data = vrm.enrich_system_with_devices(sys_data, site_id)
            
        formatted_systems.append(sys_data)
        
        print(f"\n[+] Processed System: {name}")
        print(f"    ID: {site_id}")
        print(f"    MPPTs: {sys_data.get('solar_regulator_count', 0)}")
        print(f"    Inverters: {sys_data.get('inverter_charger_count', 0)}")
        print(f"    Batteries: {sys_data.get('battery_count', 0)}")
    
    return formatted_systems

if __name__ == "__main__":
    collect_installations()
