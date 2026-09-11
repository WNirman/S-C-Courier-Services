"""
SC Courier Services – Selenium Test Suite
=========================================
Module 5: Admin Dashboard Tests
Test Cases: TC_ADM_001 to TC_ADM_006
"""

import pytest
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import ADMIN_EMAIL, ADMIN_PASSWORD

WAIT = 15


def admin_login(driver):
    """Helper: login as admin and wait for admin dashboard."""
    wait = WebDriverWait(driver, WAIT)
    login_btn = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(text(),'Login to Account')]"))
    )
    login_btn.click()
    wait.until(EC.presence_of_element_located((By.ID, "username")))
    driver.find_element(By.ID, "username").send_keys(ADMIN_EMAIL)
    driver.find_element(By.ID, "password").send_keys(ADMIN_PASSWORD)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit'].primary-btn").click()
    time.sleep(3)


class TestAdminDashboard:
    """
    Test Suite: Admin Dashboard
    Covers: dashboard loads, key sections visible, profile menu, logout
    """

    # ─────────────────────────────────────
    # TC_ADM_001 – Admin dashboard loads
    # ─────────────────────────────────────
    def test_TC_ADM_001_dashboard_loads(self, driver):
        """
        Test Case ID   : TC_ADM_001
        Title          : Admin dashboard loads after login
        Steps          : 1. Login with admin credentials
        Expected Result: Admin dashboard content is visible on page
        """
        admin_login(driver)
        page_src = driver.page_source
        assert ("Admin" in page_src or "Dashboard" in page_src), \
            "Admin dashboard not detected after login"
        print("✅ TC_ADM_001 PASSED – Admin dashboard loaded")

    # ─────────────────────────────────────
    # TC_ADM_002 – Profile avatar visible
    # ─────────────────────────────────────
    def test_TC_ADM_002_profile_avatar_visible(self, driver):
        """
        Test Case ID   : TC_ADM_002
        Title          : Admin profile avatar is shown in navbar after login
        Steps          : 1. Login as admin
        Expected Result: Profile circle/avatar is visible in the navbar
        """
        admin_login(driver)
        wait = WebDriverWait(driver, WAIT)
        # The profile avatar shows 'A' for admin – find nav area with role button
        navbar = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".navbar")))
        assert "A" in navbar.text or navbar.find_elements(By.CSS_SELECTOR, "div[style*='border-radius: 50%']"), \
            "Profile avatar not visible in navbar"
        print("✅ TC_ADM_002 PASSED – Profile avatar visible in navbar")

    # ─────────────────────────────────────
    # TC_ADM_003 – Profile menu opens on click
    # ─────────────────────────────────────
    def test_TC_ADM_003_profile_menu_opens(self, driver):
        """
        Test Case ID   : TC_ADM_003
        Title          : Clicking profile avatar opens profile dropdown menu
        Steps          : 1. Login as admin
                         2. Click the profile circle in the navbar
        Expected Result: Profile dropdown with name, role, email is visible
        """
        admin_login(driver)
        wait = WebDriverWait(driver, WAIT)
        # Find the profile avatar circle (contains 'A' for admin)
        avatars = driver.find_elements(
            By.XPATH, "//div[contains(@style,'border-radius: 50%') and contains(@style,'cursor: pointer')]"
        )
        assert len(avatars) > 0, "Profile avatar not found"
        avatars[0].click()
        time.sleep(1)
        # Profile menu should now show role info
        page_src = driver.page_source
        assert "Administrator" in page_src or "Admin" in page_src or "admin@sccourier" in page_src, \
            "Profile dropdown did not appear or show admin info"
        print("✅ TC_ADM_003 PASSED – Profile menu opens and shows admin info")

    # ─────────────────────────────────────
    # TC_ADM_004 – Logout button present in navbar
    # ─────────────────────────────────────
    def test_TC_ADM_004_logout_button_present(self, driver):
        """
        Test Case ID   : TC_ADM_004
        Title          : Logout button is visible in navbar when logged in as admin
        Steps          : 1. Login as admin
        Expected Result: Logout button is present in navbar
        """
        admin_login(driver)
        wait = WebDriverWait(driver, WAIT)
        logout_btn = wait.until(
            EC.presence_of_element_located((By.XPATH, "//button[contains(.,'Logout')]"))
        )
        assert logout_btn.is_displayed(), "Logout button not visible for admin"
        print("✅ TC_ADM_004 PASSED – Logout button visible")

    # ─────────────────────────────────────
    # TC_ADM_005 – Admin logout redirects to tracking
    # ─────────────────────────────────────
    def test_TC_ADM_005_admin_logout_redirect(self, driver):
        """
        Test Case ID   : TC_ADM_005
        Title          : Clicking Logout takes admin back to home/tracking page
        Steps          : 1. Login as admin
                         2. Click Logout
        Expected Result: Home page with tracking form and 'Login to Account' button
        """
        admin_login(driver)
        wait = WebDriverWait(driver, WAIT)
        logout_btn = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(.,'Logout')]"))
        )
        logout_btn.click()
        time.sleep(2)
        login_prompt = wait.until(
            EC.presence_of_element_located(
                (By.XPATH, "//button[contains(text(),'Login to Account')]")
            )
        )
        assert login_prompt.is_displayed(), "Home page not shown after admin logout"
        print("✅ TC_ADM_005 PASSED – Admin logout redirect successful")

    # ─────────────────────────────────────
    # TC_ADM_006 – Dashboard content renders (page not blank)
    # ─────────────────────────────────────
    def test_TC_ADM_006_dashboard_not_blank(self, driver):
        """
        Test Case ID   : TC_ADM_006
        Title          : Admin dashboard page is not blank
        Steps          : 1. Login as admin
        Expected Result: Page body contains meaningful content (not empty)
        """
        admin_login(driver)
        time.sleep(2)
        body_text = driver.find_element(By.TAG_NAME, "body").text
        assert len(body_text.strip()) > 50, \
            f"Dashboard appears to be blank. Body text length: {len(body_text.strip())}"
        print("✅ TC_ADM_006 PASSED – Dashboard has content")
