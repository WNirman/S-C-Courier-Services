"""
SC Courier Services - Selenium Test Configuration
conftest.py - Shared fixtures and setup for all test modules
"""

import pytest
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# ─────────────────────────────────────────────
#  GLOBAL CONFIGURATION
# ─────────────────────────────────────────────
BASE_URL = "http://localhost:5173"          # Vite dev server (npm run dev)
IMPLICIT_WAIT  = 10                         # seconds
EXPLICIT_WAIT  = 15                         # seconds for WebDriverWait

# ─────────────────────────────────────────────
#  CREDENTIALS  (change as needed)
# ─────────────────────────────────────────────
ADMIN_EMAIL    = "admin@sccourier.com"
ADMIN_PASSWORD = "admin123"

# Replace with a real staff email/password from your database
STAFF_EMAIL    = "staff@sccourier.com"
STAFF_PASSWORD = "staff123"

# Replace with a real customer email/password from your database
CUSTOMER_EMAIL    = "customer@test.com"
CUSTOMER_PASSWORD = "test1234"


# ─────────────────────────────────────────────
#  DRIVER FIXTURE
# ─────────────────────────────────────────────
@pytest.fixture(scope="function")
def driver():
    """
    Creates a fresh Chrome WebDriver for every test function.
    Automatically downloads the correct ChromeDriver via webdriver-manager.
    """
    chrome_options = Options()
    # ── Uncomment the next line to run tests WITHOUT opening a browser window ──
    # chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--disable-notifications")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-extensions")

    service = Service(ChromeDriverManager().install())
    driver  = webdriver.Chrome(service=service, options=chrome_options)
    driver.implicitly_wait(IMPLICIT_WAIT)
    driver.get(BASE_URL)

    yield driver

    driver.quit()


# ─────────────────────────────────────────────
#  HELPER: navigate to Login page
# ─────────────────────────────────────────────
@pytest.fixture(scope="function")
def login_page(driver):
    """Opens the app and clicks 'Login to Account' to reach the login form."""
    wait = WebDriverWait(driver, EXPLICIT_WAIT)
    # Click the "Login to Account" button on the home/tracking page
    login_btn = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(text(),'Login to Account')]"))
    )
    login_btn.click()
    # Wait for the login form to appear
    wait.until(EC.presence_of_element_located((By.ID, "username")))
    return driver


# ─────────────────────────────────────────────
#  HELPER: perform a full login
# ─────────────────────────────────────────────
def do_login(driver, email, password):
    """Fills in credentials and clicks Login to Dashboard."""
    wait = WebDriverWait(driver, EXPLICIT_WAIT)
    driver.find_element(By.ID, "username").clear()
    driver.find_element(By.ID, "username").send_keys(email)
    driver.find_element(By.ID, "password").clear()
    driver.find_element(By.ID, "password").send_keys(password)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit'].primary-btn").click()
    time.sleep(2)   # allow redirect animation to complete
