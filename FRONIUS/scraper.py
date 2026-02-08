import os
import time
import json
import logging
from datetime import datetime
from dotenv import load_dotenv

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager    

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

SOLARWEB_EMAIL = os.getenv("SOLARWEB_EMAIL")
SOLARWEB_PASSWORD = os.getenv("SOLARWEB_PASSWORD")
SOLARWEB_BASE_URL = "https://www.solarweb.com"

class FroniusScraper:
    def __init__(self, headless=True):
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")
        
        self.driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
        self.wait = WebDriverWait(self.driver, 20)

    def login(self):
        logger.info("Attempting to login to SolarWeb...")
        # Start with the main page or direct to ExternalLogin which is the actual entry point now
        self.driver.get(f"{SOLARWEB_BASE_URL}/Account/ExternalLogin")
        
        try:
            # Wait for any redirect (SolarWeb often redirects to a login provider like Keycloak/B2C)
            time.sleep(5)
            logger.info(f"URL after load/redirect: {self.driver.current_url}")
            
            # Handle Cookiebot Dialog if present
            self.handle_cookiebot()

            # Sometimes SolarWeb redirects to a separate login page (e.g., login.fronius.com)
            # We need to wait for the username field to appear on whatever page we ended up on
            logger.info("Waiting for login form fields...")
            
            # Expanded selectors for different login page versions
            username_selectors = [
                (By.ID, "usernameUserInput"), # Fronius Login page
                (By.ID, "Username"), 
                (By.NAME, "Username"),
                (By.ID, "email"), 
                (By.ID, "i0116"), # Common for Azure AD / Microsoft
                (By.CSS_SELECTOR, "input[type='email']"),
                (By.CSS_SELECTOR, "input[name='loginfmt']")
            ]
            
            user_input = None
            for by, selector in username_selectors:
                try:
                    user_input = WebDriverWait(self.driver, 10).until(
                        EC.visibility_of_element_located((by, selector))
                    )
                    if user_input:
                        logger.info(f"Found username field: {selector}")
                        break
                except:
                    continue
            
            if not user_input:
                if "LogOff" in self.driver.page_source:
                    logger.info("Already logged in!")
                    return True
                raise Exception(f"Login form not found. Check login_error.png. URL: {self.driver.current_url}")

            # Once username is found, find password
            user_input.clear()
            user_input.send_keys(SOLARWEB_EMAIL)
            
            # Find password
            # password field might be on the same page or next page
            pass_input = None
            password_selectors = [
                (By.ID, "password"), 
                (By.NAME, "password"),
                (By.ID, "Password"), 
                (By.NAME, "Password"), 
                (By.ID, "i0118")
            ]
            
            for by, selector in password_selectors:
                try:
                    pass_input = self.driver.find_element(by, selector)
                    if pass_input.is_displayed():
                        logger.info(f"Found password field: {selector}")
                        break
                    else:
                        pass_input = None
                except:
                    continue
                
            if not pass_input:
                logger.info("Password field not visible, checking for 'Next' button (2-step login)...")
                next_btn_selectors = ["#idSIButton9", ".btn-primary", "input[type='submit']", "#login-button"]
                for sel in next_btn_selectors:
                    try:
                        btn = self.driver.find_element(By.CSS_SELECTOR, sel)
                        if btn.is_displayed():
                            btn.click()
                            logger.info(f"Clicked 'Next' button: {sel}")
                            time.sleep(2)
                            break
                    except:
                        continue
                
                # Try finding password again after 'Next'
                for by, selector in password_selectors:
                    try:
                        pass_input = WebDriverWait(self.driver, 5).until(
                            EC.visibility_of_element_located((by, selector))
                        )
                        if pass_input:
                            logger.info(f"Found password field after 'Next': {selector}")
                            break
                    except:
                        continue

            if not pass_input:
                raise Exception("Could not find password field.")

            pass_input.clear()
            pass_input.send_keys(SOLARWEB_PASSWORD)
            
            login_btn = None
            login_btn_selectors = [
                (By.ID, "login-button"),
                (By.CSS_SELECTOR, "button[type='submit']"),
                (By.CSS_SELECTOR, "input[type='submit']"),
                (By.ID, "idSIButton9")
            ]
            for by, selector in login_btn_selectors:
                try:
                    login_btn = self.driver.find_element(by, selector)
                    if login_btn.is_displayed():
                        break
                except:
                    continue
            
            if not login_btn:
                raise Exception("Could not find login button.")
                
            login_btn.click()
            
            # Verify login status
            logger.info("Verifying login status...")
            # On cherche des éléments présents sur le dashboard
            self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "a[href*='LogOff'], #LogOut, .pvsystem-widget-container, #js-pvsystem-table-id")))
            logger.info("Login successful!")
            return True
        except Exception as e:
            logger.error(f"Login failed: {e}")
            self.driver.save_screenshot("login_error.png")
            with open("page_source_error.html", "w", encoding="utf-8") as f:
                f.write(self.driver.page_source)
            return False

    def handle_cookiebot(self):
        try:
            # Essayer plusieurs sélecteurs pour le bouton "Tout autoriser"
            selectors = [
                "CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
                "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
                "button[id*='AllowAll']"
            ]
            for sel in selectors:
                try:
                    btn = WebDriverWait(self.driver, 5).until(
                        EC.element_to_be_clickable((By.ID if not sel.startswith('#') and ' ' not in sel else By.CSS_SELECTOR, sel))
                    )
                    btn.click()
                    logger.info("Cookiebot: Clicked 'Autoriser tout'")
                    time.sleep(2)
                    return True
                except:
                    continue
        except:
            pass
        return False

    def get_all_installations(self):
        logger.info("Fetching installation list...")
        self.driver.get(f"{SOLARWEB_BASE_URL}/PvSystems/Widgets")
        
        # Gérer le cookiebot s'il réapparaît
        self.handle_cookiebot()
        
        installations = []
        try:
            # On attend que la table soit chargée
            time.sleep(15) 
            self.driver.save_screenshot("debug_list.png")
            with open("debug_dom.html", "w", encoding="utf-8") as f:
                f.write(self.driver.page_source)
            
            # Essayer de trouver les liens de la table
            systems = self.driver.find_elements(By.CSS_SELECTOR, "a")
            logger.info(f"Total links found: {len(systems)}")
            
            # Rechercher un pattern d'ID système dans les href ou le texte
            # ...
            
            if not systems:
                logger.warning("No links found with 'pvSystemId=', trying table rows...")
                # Essayer de trouver la table directement si les liens sont masqués ou chargés différemment
                rows = self.driver.find_elements(By.CSS_SELECTOR, "tr")
                # ... extraction plus complexe ici si nécessaire
            
            found_ids = set()
            for system in systems:
                try:
                    url = system.get_attribute("href")
                    name = system.text.strip()
                    
                    if not name:
                        # Parfois le nom est dans un parent ou un attribut
                        try:
                            name = system.find_element(By.XPATH, "..").text.strip()
                        except:
                            name = "Unknown"
                            
                    if "pvSystemId=" in url:
                        pv_system_id = url.split("pvSystemId=")[-1]
                        if pv_system_id not in found_ids:
                            installations.append({
                                "name": name,
                                "pv_system_id": pv_system_id,
                                "url": url
                            })
                            found_ids.add(pv_system_id)
                except:
                    continue
                    
            logger.info(f"Found {len(installations)} installations links.")
            return installations
        except Exception as e:
            logger.error(f"Error fetching installations: {e}")
            self.driver.save_screenshot("list_error.png")
            return []

    def get_system_components(self, pv_system_id):
        logger.info(f"Fetching components for system {pv_system_id}...")
        url = f"{SOLARWEB_BASE_URL}/PvSystemComponents/Components?pvSystemId={pv_system_id}"
        self.driver.get(url)
        
        components = []
        try:
            # SolarWeb components page usually lists inverters, sensors, etc.
            # Need to identify correct selectors once page layout is known
            container = self.wait.until(EC.presence_of_element_located((By.ID, "pv-system-components-container")))
            # This is a placeholder for actual parsing logic
            # We would typically look for table rows or cards
            return {"status": "success", "data": "To be implemented with actual selectors"}
        except Exception as e:
            logger.error(f"Error fetching components: {e}")
            return None

    def close(self):
        self.driver.quit()

if __name__ == "__main__":
    scraper = FroniusScraper(headless=True)
    if scraper.login():
        installs = scraper.get_all_installations()
        print(json.dumps(installs, indent=2))
        
        if installs:
            # Test first one
            comp = scraper.get_system_components(installs[0]["pv_system_id"])
            print(comp)
            
    scraper.close()
