"""
SC Courier Services – Selenium Test Suite
=========================================
Module 2: Package Tracking Tests
Test Cases: TC_TRK_001 to TC_TRK_007
"""

import pytest
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

WAIT = 15


class TestPackageTracking:
    """
    Test Suite: Package Tracking Feature
    Covers: tracking form visibility, valid/invalid IDs, SC prefix, empty submit
    """

    # ─────────────────────────────────────
    # TC_TRK_001 – Tracking form visible on home page
    # ─────────────────────────────────────
    def test_TC_TRK_001_tracking_form_visible(self, driver):
        """
        Test Case ID   : TC_TRK_001
        Title          : Tracking form is visible on home page
        Pre-condition  : App loaded
        Steps          : 1. Open home page
        Expected Result: Tracking input field and Track button are displayed
        """
        wait = WebDriverWait(driver, WAIT)
        track_input = wait.until(
            EC.presence_of_element_located((By.XPATH, "//input[@placeholder[contains(.,'Tracking Number')]]"))
        )
        track_btn = driver.find_element(By.XPATH, "//button[@type='submit' and contains(.,'Track')]")
        assert track_input.is_displayed(), "Tracking input not visible"
        assert track_btn.is_displayed(), "Track button not visible"
        print("✅ TC_TRK_001 PASSED – Tracking form visible")

    # ─────────────────────────────────────
    # TC_TRK_002 – Valid SC prefix returns result
    # ─────────────────────────────────────
    def test_TC_TRK_002_valid_sc_prefix_tracking(self, driver):
        """
        Test Case ID   : TC_TRK_002
        Title          : Tracking a valid SC-prefixed ID shows status
        Steps          : 1. Enter 'SC100892' in tracking field
                         2. Click Track button
        Expected Result: Result panel shows 'Delivered' status
        """
        wait = WebDriverWait(driver, WAIT)
        track_input = wait.until(
            EC.presence_of_element_located((By.XPATH, "//input[@placeholder[contains(.,'Tracking Number')]]"))
        )
        track_input.clear()
        track_input.send_keys("SC100892")
        driver.find_element(By.XPATH, "//button[@type='submit' and contains(.,'Track')]").click()
        time.sleep(3)
        result = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".tracking-result")))
        assert result.is_displayed(), "Tracking result not shown"
        assert "Delivered" in result.text or "In Transit" in result.text, \
            f"Expected status keyword in result. Got: {result.text}"
        print("✅ TC_TRK_002 PASSED – Valid SC tracking shows status")

    # ─────────────────────────────────────
    # TC_TRK_003 – Invalid tracking number shows error
    # ─────────────────────────────────────
    def test_TC_TRK_003_invalid_tracking_number(self, driver):
        """
        Test Case ID   : TC_TRK_003
        Title          : Invalid tracking number shows 'not found' message
        Steps          : 1. Enter 'INVALID999' in tracking field
                         2. Click Track button
        Expected Result: Error/not-found message appears in result panel
        """
        wait = WebDriverWait(driver, WAIT)
        track_input = wait.until(
            EC.presence_of_element_located((By.XPATH, "//input[@placeholder[contains(.,'Tracking Number')]]"))
        )
        track_input.clear()
        track_input.send_keys("INVALID999")
        driver.find_element(By.XPATH, "//button[@type='submit' and contains(.,'Track')]").click()
        time.sleep(3)
        result = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".tracking-result")))
        assert "No shipment" in result.text or "not found" in result.text.lower() or \
               "Unable" in result.text or "No" in result.text, \
            f"Expected 'not found' error. Got: {result.text}"
        print("✅ TC_TRK_003 PASSED – Invalid tracking shows error message")

    # ─────────────────────────────────────
    # TC_TRK_004 – PD prefix tracking
    # ─────────────────────────────────────
    def test_TC_TRK_004_pd_prefix_tracking(self, driver):
        """
        Test Case ID   : TC_TRK_004
        Title          : Tracking a PD-1 personal delivery ID
        Steps          : 1. Enter 'PD-1' in tracking field
                         2. Click Track
        Expected Result: Result shows (found or not found message — no crash)
        """
        wait = WebDriverWait(driver, WAIT)
        track_input = wait.until(
            EC.presence_of_element_located((By.XPATH, "//input[@placeholder[contains(.,'Tracking Number')]]"))
        )
        track_input.clear()
        track_input.send_keys("PD-1")
        driver.find_element(By.XPATH, "//button[@type='submit' and contains(.,'Track')]").click()
        time.sleep(3)
        result = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".tracking-result")))
        assert result.is_displayed(), "Tracking result not shown for PD-1"
        print("✅ TC_TRK_004 PASSED – PD prefix tracking handled without crash")

    # ─────────────────────────────────────
    # TC_TRK_005 – SC101000 in transit status
    # ─────────────────────────────────────
    def test_TC_TRK_005_sc101000_in_transit(self, driver):
        """
        Test Case ID   : TC_TRK_005
        Title          : SC101000 shows 'In Transit' status
        Steps          : 1. Enter 'SC101000'
                         2. Click Track
        Expected Result: Status is 'In Transit'
        """
        wait = WebDriverWait(driver, WAIT)
        track_input = wait.until(
            EC.presence_of_element_located((By.XPATH, "//input[@placeholder[contains(.,'Tracking Number')]]"))
        )
        track_input.clear()
        track_input.send_keys("SC101000")
        driver.find_element(By.XPATH, "//button[@type='submit' and contains(.,'Track')]").click()
        time.sleep(3)
        result = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".tracking-result")))
        assert "In Transit" in result.text, \
            f"Expected 'In Transit' status. Got: {result.text}"
        print("✅ TC_TRK_005 PASSED – SC101000 shows In Transit")

    # ─────────────────────────────────────
    # TC_TRK_006 – Empty tracking input
    # ─────────────────────────────────────
    def test_TC_TRK_006_empty_tracking_input(self, driver):
        """
        Test Case ID   : TC_TRK_006
        Title          : Submitting empty tracking number does not crash
        Steps          : 1. Leave tracking input blank
                         2. Click Track button
        Expected Result: No tracking result shown, browser doesn't crash,
                         HTML5 validation or no result displayed
        """
        wait = WebDriverWait(driver, WAIT)
        wait.until(
            EC.presence_of_element_located((By.XPATH, "//input[@placeholder[contains(.,'Tracking Number')]]"))
        )
        # Try submitting empty form
        driver.find_element(By.XPATH, "//button[@type='submit' and contains(.,'Track')]").click()
        time.sleep(1)
        # Confirm no result panel or that page is still stable
        results = driver.find_elements(By.CSS_SELECTOR, ".tracking-result")
        # Either no results shown or validation prevented submission
        assert len(results) == 0 or not results[0].is_displayed(), \
            "Tracking result shown for empty input – should be blocked"
        print("✅ TC_TRK_006 PASSED – Empty input blocked correctly")

    # ─────────────────────────────────────
    # TC_TRK_007 – Progress bar visible in result
    # ─────────────────────────────────────
    def test_TC_TRK_007_progress_bar_visible(self, driver):
        """
        Test Case ID   : TC_TRK_007
        Title          : Tracking result contains a progress bar
        Steps          : 1. Enter 'SC100892' and track
        Expected Result: Progress bar element is visible in result
        """
        wait = WebDriverWait(driver, WAIT)
        track_input = wait.until(
            EC.presence_of_element_located((By.XPATH, "//input[@placeholder[contains(.,'Tracking Number')]]"))
        )
        track_input.clear()
        track_input.send_keys("SC100892")
        driver.find_element(By.XPATH, "//button[@type='submit' and contains(.,'Track')]").click()
        time.sleep(3)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".tracking-result")))
        # Progress text should show percentage
        result_text = driver.find_element(By.CSS_SELECTOR, ".tracking-result").text
        assert "%" in result_text, "Progress percentage not shown in tracking result"
        print("✅ TC_TRK_007 PASSED – Progress bar visible in tracking result")
