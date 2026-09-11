"""
SC Courier Services – Selenium Test Suite
=========================================
Module 1: Home Page & Navigation Tests
Test Cases: TC_NAV_001 to TC_NAV_006
"""

import pytest
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "http://localhost:5173"
WAIT = 15


class TestNavigation:
    """
    Test Suite: Navigation & Home Page
    Covers: page title, navbar links, brand logo, nav link active states
    """

    # ─────────────────────────────────────
    # TC_NAV_001 – Verify page title
    # ─────────────────────────────────────
    def test_TC_NAV_001_page_title(self, driver):
        """
        Test Case ID   : TC_NAV_001
        Title          : Verify correct page title loads
        Pre-condition  : Browser open at BASE_URL
        Steps          : 1. Navigate to BASE_URL
        Expected Result: Title contains 'SC Courier'
        """
        assert "SC Courier" in driver.title, \
            f"Expected 'SC Courier' in title, got: '{driver.title}'"
        print("✅ TC_NAV_001 PASSED – Page title correct")

    # ─────────────────────────────────────
    # TC_NAV_002 – Verify navbar is visible
    # ─────────────────────────────────────
    def test_TC_NAV_002_navbar_visible(self, driver):
        """
        Test Case ID   : TC_NAV_002
        Title          : Navbar is visible on home page
        Pre-condition  : App loaded at BASE_URL
        Steps          : 1. Look for .navbar element
        Expected Result: Navbar element is displayed
        """
        wait = WebDriverWait(driver, WAIT)
        navbar = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".navbar")))
        assert navbar.is_displayed(), "Navbar is not visible"
        print("✅ TC_NAV_002 PASSED – Navbar visible")

    # ─────────────────────────────────────
    # TC_NAV_003 – Click 'Services' nav link
    # ─────────────────────────────────────
    def test_TC_NAV_003_services_nav_link(self, driver):
        """
        Test Case ID   : TC_NAV_003
        Title          : Clicking 'Services' nav link shows Services content
        Steps          : 1. Click 'Services' link in navbar
        Expected Result: Page shows 'Our Services' heading
        """
        wait = WebDriverWait(driver, WAIT)
        services_link = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//a[contains(text(),'Services')]"))
        )
        services_link.click()
        time.sleep(1)
        heading = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//h1[contains(.,'Services')]"))
        )
        assert heading.is_displayed(), "Services heading not found after clicking Services"
        print("✅ TC_NAV_003 PASSED – Services page content visible")

    # ─────────────────────────────────────
    # TC_NAV_004 – Click 'About' nav link
    # ─────────────────────────────────────
    def test_TC_NAV_004_about_nav_link(self, driver):
        """
        Test Case ID   : TC_NAV_004
        Title          : Clicking 'About' nav link shows About content
        Steps          : 1. Click 'About' in navbar
        Expected Result: Page shows 'About Us' heading
        """
        wait = WebDriverWait(driver, WAIT)
        about_link = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//a[contains(text(),'About')]"))
        )
        about_link.click()
        time.sleep(1)
        heading = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//h1[contains(.,'About')]"))
        )
        assert heading.is_displayed(), "About heading not found"
        print("✅ TC_NAV_004 PASSED – About page content visible")

    # ─────────────────────────────────────
    # TC_NAV_005 – Click 'Contact Us' nav link
    # ─────────────────────────────────────
    def test_TC_NAV_005_contact_nav_link(self, driver):
        """
        Test Case ID   : TC_NAV_005
        Title          : Clicking 'Contact Us' link shows Contact content
        Steps          : 1. Click 'Contact Us' in navbar
        Expected Result: Page shows 'Contact Us' heading
        """
        wait = WebDriverWait(driver, WAIT)
        contact_link = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//a[contains(text(),'Contact')]"))
        )
        contact_link.click()
        time.sleep(1)
        heading = wait.until(
            EC.visibility_of_element_located((By.XPATH, "//h1[contains(.,'Contact')]"))
        )
        assert heading.is_displayed(), "Contact heading not found"
        print("✅ TC_NAV_005 PASSED – Contact page content visible")

    # ─────────────────────────────────────
    # TC_NAV_006 – Logo click returns to Home
    # ─────────────────────────────────────
    def test_TC_NAV_006_logo_returns_home(self, driver):
        """
        Test Case ID   : TC_NAV_006
        Title          : Clicking logo from any page returns to Home/Tracking
        Steps          : 1. Navigate to Services
                         2. Click brand logo
        Expected Result: Tracking form reappears
        """
        wait = WebDriverWait(driver, WAIT)
        # Go to Services first
        services_link = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//a[contains(text(),'Services')]"))
        )
        services_link.click()
        time.sleep(1)
        # Click logo
        logo = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".logo")))
        logo.click()
        time.sleep(1)
        # Tracking form should be visible
        track_input = wait.until(
            EC.presence_of_element_located((By.XPATH, "//input[@placeholder[contains(.,'Tracking Number')]]"))
        )
        assert track_input.is_displayed(), "Tracking input not found after logo click"
        print("✅ TC_NAV_006 PASSED – Logo click returns to home")
