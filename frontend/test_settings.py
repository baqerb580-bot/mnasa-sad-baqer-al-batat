#!/usr/bin/env python3
"""
Settings System Testing Script
Tests all 7 settings endpoints for the Ghazlan ERP system
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://isp-noc-hub.preview.emergentagent.com/api"

def print_test(name, passed, details=""):
    status = "✅ PASSED" if passed else "❌ FAILED"
    print(f"\n{status} - {name}")
    if details:
        print(f"  Details: {details}")

def test_get_settings():
    """Test 1: GET /api/settings - Should return 16 sections + metadata"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/settings")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/settings")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_test("GET /api/settings", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Check for required metadata fields
        required_meta = ['id', 'createdAt', 'updatedAt']
        for field in required_meta:
            if field not in data:
                print_test("GET /api/settings", False, f"Missing metadata field: {field}")
                return False
        
        # Check for 16 sections
        expected_sections = [
            'general', 'users', 'agents', 'subscribers', 'zones', 'invoices',
            'packages', 'whatsapp', 'telegram', 'notifications', 'maps',
            'printing', 'backup', 'security', 'reports', 'employees'
        ]
        
        missing_sections = [s for s in expected_sections if s not in data]
        if missing_sections:
            print_test("GET /api/settings", False, f"Missing sections: {missing_sections}")
            return False
        
        # Verify defaults are loaded
        if data.get('general', {}).get('companyName') != 'مركز الغزلان':
            print_test("GET /api/settings", False, f"Default companyName incorrect: {data.get('general', {}).get('companyName')}")
            return False
        
        if data.get('whatsapp', {}).get('enabled') != False:
            print_test("GET /api/settings", False, f"Default whatsapp.enabled should be False")
            return False
        
        print_test("GET /api/settings", True, f"All 16 sections present with correct defaults")
        return True
        
    except Exception as e:
        print_test("GET /api/settings", False, f"Exception: {str(e)}")
        return False

def test_put_settings_deep_merge():
    """Test 2: PUT /api/settings - Test deep merge functionality"""
    print("\n" + "="*80)
    print("TEST 2: PUT /api/settings - Deep Merge")
    print("="*80)
    
    try:
        # Test 2a: Update only companyName in general section
        print("\n--- Test 2a: Partial update of general.companyName ---")
        update_data = {
            "general": {
                "companyName": "TEST_NAME"
            }
        }
        
        response = requests.put(f"{BASE_URL}/settings", json=update_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_test("PUT /api/settings (2a)", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Verify companyName changed
        if data.get('general', {}).get('companyName') != 'TEST_NAME':
            print_test("PUT /api/settings (2a)", False, f"companyName not updated: {data.get('general', {}).get('companyName')}")
            return False
        
        # Verify other general fields preserved
        if data.get('general', {}).get('companyNameEn') != 'Ghazlan Center':
            print_test("PUT /api/settings (2a)", False, "Other general fields not preserved")
            return False
        
        # Verify updatedAt changed
        if 'updatedAt' not in data:
            print_test("PUT /api/settings (2a)", False, "updatedAt not present")
            return False
        
        print_test("PUT /api/settings (2a)", True, "Partial update successful, other fields preserved")
        
        # Test 2b: Update multiple fields in whatsapp section
        print("\n--- Test 2b: Update multiple whatsapp fields ---")
        update_data = {
            "whatsapp": {
                "enabled": True,
                "apiToken": "test123"
            }
        }
        
        response = requests.put(f"{BASE_URL}/settings", json=update_data)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_test("PUT /api/settings (2b)", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Verify both fields updated
        if data.get('whatsapp', {}).get('enabled') != True:
            print_test("PUT /api/settings (2b)", False, "whatsapp.enabled not updated")
            return False
        
        if data.get('whatsapp', {}).get('apiToken') != 'test123':
            print_test("PUT /api/settings (2b)", False, "whatsapp.apiToken not updated")
            return False
        
        # Verify general.companyName still TEST_NAME from previous update
        if data.get('general', {}).get('companyName') != 'TEST_NAME':
            print_test("PUT /api/settings (2b)", False, "Previous updates not preserved")
            return False
        
        print_test("PUT /api/settings (2b)", True, "Multiple fields updated, previous changes preserved")
        
        # Test 2c: Verify activity_log entry was created
        print("\n--- Test 2c: Verify activity_log entry ---")
        response = requests.get(f"{BASE_URL}/activity-logs")
        
        if response.status_code != 200:
            print_test("PUT /api/settings (2c)", False, "Could not fetch activity logs")
            return False
        
        logs = response.json()
        settings_logs = [log for log in logs if log.get('action') == 'settings_update']
        
        if len(settings_logs) < 2:
            print_test("PUT /api/settings (2c)", False, f"Expected at least 2 settings_update logs, found {len(settings_logs)}")
            return False
        
        print_test("PUT /api/settings (2c)", True, f"Activity log entries created ({len(settings_logs)} found)")
        
        return True
        
    except Exception as e:
        print_test("PUT /api/settings", False, f"Exception: {str(e)}")
        return False

def test_reset_section():
    """Test 3: POST /api/settings/reset with {section: 'general'}"""
    print("\n" + "="*80)
    print("TEST 3: POST /api/settings/reset - Reset single section")
    print("="*80)
    
    try:
        # Reset only general section
        response = requests.post(f"{BASE_URL}/settings/reset", json={"section": "general"})
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_test("Reset section", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if not data.get('success'):
            print_test("Reset section", False, "Response success=false")
            return False
        
        # Verify general section reset
        response = requests.get(f"{BASE_URL}/settings")
        settings = response.json()
        
        if settings.get('general', {}).get('companyName') != 'مركز الغزلان':
            print_test("Reset section", False, f"general.companyName not reset: {settings.get('general', {}).get('companyName')}")
            return False
        
        # Verify whatsapp section unchanged (should still have enabled=true from previous test)
        if settings.get('whatsapp', {}).get('enabled') != True:
            print_test("Reset section", False, "Other sections were affected by section reset")
            return False
        
        print_test("Reset section", True, "Only general section reset, others preserved")
        return True
        
    except Exception as e:
        print_test("Reset section", False, f"Exception: {str(e)}")
        return False

def test_reset_all():
    """Test 4: POST /api/settings/reset with {} - Reset ALL sections"""
    print("\n" + "="*80)
    print("TEST 4: POST /api/settings/reset - Reset ALL sections")
    print("="*80)
    
    try:
        response = requests.post(f"{BASE_URL}/settings/reset", json={})
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_test("Reset all", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if not data.get('success'):
            print_test("Reset all", False, "Response success=false")
            return False
        
        # Verify all sections reset
        response = requests.get(f"{BASE_URL}/settings")
        settings = response.json()
        
        if settings.get('general', {}).get('companyName') != 'مركز الغزلان':
            print_test("Reset all", False, "general section not reset")
            return False
        
        if settings.get('whatsapp', {}).get('enabled') != False:
            print_test("Reset all", False, "whatsapp section not reset")
            return False
        
        if settings.get('whatsapp', {}).get('apiToken') != '':
            print_test("Reset all", False, "whatsapp.apiToken not reset")
            return False
        
        print_test("Reset all", True, "All sections reset to defaults")
        return True
        
    except Exception as e:
        print_test("Reset all", False, f"Exception: {str(e)}")
        return False

def test_whatsapp_integration():
    """Test 5: POST /api/settings/test/whatsapp"""
    print("\n" + "="*80)
    print("TEST 5: POST /api/settings/test/whatsapp")
    print("="*80)
    
    try:
        # Test 5a: Should fail when whatsapp.enabled=false
        print("\n--- Test 5a: Test with whatsapp disabled ---")
        response = requests.post(f"{BASE_URL}/settings/test/whatsapp", json={"phone": "07901234567"})
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print_test("WhatsApp test (5a)", False, "Should fail when whatsapp disabled")
            return False
        
        data = response.json()
        if 'error' not in data:
            print_test("WhatsApp test (5a)", False, "Expected error message")
            return False
        
        print_test("WhatsApp test (5a)", True, f"Correctly failed: {data.get('error')}")
        
        # Test 5b: Enable whatsapp and test again
        print("\n--- Test 5b: Enable whatsapp and test ---")
        update_response = requests.put(f"{BASE_URL}/settings", json={
            "whatsapp": {
                "enabled": True,
                "apiToken": "test_token_123"
            }
        })
        
        if update_response.status_code != 200:
            print_test("WhatsApp test (5b)", False, "Could not enable whatsapp")
            return False
        
        # Now test should succeed
        response = requests.post(f"{BASE_URL}/settings/test/whatsapp", json={"phone": "07901234567"})
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_test("WhatsApp test (5b)", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if not data.get('success'):
            print_test("WhatsApp test (5b)", False, "Response success=false")
            return False
        
        # Verify message was added to whatsapp_messages
        messages_response = requests.get(f"{BASE_URL}/whatsapp-messages")
        if messages_response.status_code != 200:
            print_test("WhatsApp test (5b)", False, "Could not fetch whatsapp messages")
            return False
        
        messages = messages_response.json()
        test_messages = [m for m in messages if m.get('type') == 'test']
        
        if len(test_messages) == 0:
            print_test("WhatsApp test (5b)", False, "No test message found in whatsapp_messages")
            return False
        
        print_test("WhatsApp test (5b)", True, f"Test message created successfully (found {len(test_messages)} test messages)")
        
        return True
        
    except Exception as e:
        print_test("WhatsApp test", False, f"Exception: {str(e)}")
        return False

def test_telegram_integration():
    """Test 6: POST /api/settings/test/telegram"""
    print("\n" + "="*80)
    print("TEST 6: POST /api/settings/test/telegram")
    print("="*80)
    
    try:
        # Test 6a: Should fail when telegram.enabled=false
        print("\n--- Test 6a: Test with telegram disabled ---")
        response = requests.post(f"{BASE_URL}/settings/test/telegram", json={})
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print_test("Telegram test (6a)", False, "Should fail when telegram disabled")
            return False
        
        data = response.json()
        if 'error' not in data:
            print_test("Telegram test (6a)", False, "Expected error message")
            return False
        
        print_test("Telegram test (6a)", True, f"Correctly failed: {data.get('error')}")
        
        # Test 6b: Enable telegram but no botToken
        print("\n--- Test 6b: Enable telegram without botToken ---")
        update_response = requests.put(f"{BASE_URL}/settings", json={
            "telegram": {
                "enabled": True
            }
        })
        
        if update_response.status_code != 200:
            print_test("Telegram test (6b)", False, "Could not enable telegram")
            return False
        
        response = requests.post(f"{BASE_URL}/settings/test/telegram", json={})
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print_test("Telegram test (6b)", False, "Should fail without botToken")
            return False
        
        data = response.json()
        if 'لم يتم تعيين Bot Token' not in data.get('error', ''):
            print_test("Telegram test (6b)", False, f"Expected 'لم يتم تعيين Bot Token' error, got: {data.get('error')}")
            return False
        
        print_test("Telegram test (6b)", True, "Correctly failed without botToken")
        
        # Test 6c: With fake botToken (expect Telegram API error, not crash)
        print("\n--- Test 6c: Test with fake botToken ---")
        update_response = requests.put(f"{BASE_URL}/settings", json={
            "telegram": {
                "enabled": True,
                "botToken": "123:fake",
                "managerChatId": "123456"
            }
        })
        
        if update_response.status_code != 200:
            print_test("Telegram test (6c)", False, "Could not update telegram settings")
            return False
        
        response = requests.post(f"{BASE_URL}/settings/test/telegram", json={})
        print(f"Status Code: {response.status_code}")
        
        # Should fail with Telegram API error (not 500 crash)
        if response.status_code == 500:
            print_test("Telegram test (6c)", False, "Server crashed (500 error)")
            return False
        
        data = response.json()
        
        # Should have error from Telegram API
        if 'error' not in data:
            print_test("Telegram test (6c)", False, "Expected error from Telegram API")
            return False
        
        print_test("Telegram test (6c)", True, f"Handled Telegram API error gracefully: {data.get('error')}")
        
        return True
        
    except Exception as e:
        print_test("Telegram test", False, f"Exception: {str(e)}")
        return False

def test_backup_run():
    """Test 7: POST /api/settings/backup/run"""
    print("\n" + "="*80)
    print("TEST 7: POST /api/settings/backup/run")
    print("="*80)
    
    try:
        response = requests.post(f"{BASE_URL}/settings/backup/run", json={})
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_test("Backup run", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Verify response structure
        required_fields = ['success', 'backupId', 'stats', 'timestamp']
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            print_test("Backup run", False, f"Missing fields: {missing_fields}")
            return False
        
        if not data.get('success'):
            print_test("Backup run", False, "Response success=false")
            return False
        
        # Verify stats contains collection counts
        stats = data.get('stats', {})
        if not isinstance(stats, dict) or len(stats) == 0:
            print_test("Backup run", False, "Stats is empty or not a dict")
            return False
        
        print(f"Backup stats: {json.dumps(stats, indent=2)}")
        
        # Verify backup.lastBackup was updated in settings
        settings_response = requests.get(f"{BASE_URL}/settings")
        if settings_response.status_code != 200:
            print_test("Backup run", False, "Could not fetch settings")
            return False
        
        settings = settings_response.json()
        last_backup = settings.get('backup', {}).get('lastBackup')
        
        if not last_backup:
            print_test("Backup run", False, "backup.lastBackup not set in settings")
            return False
        
        print(f"Last backup timestamp: {last_backup}")
        
        # Verify activity_log entry was created
        logs_response = requests.get(f"{BASE_URL}/activity-logs")
        if logs_response.status_code != 200:
            print_test("Backup run", False, "Could not fetch activity logs")
            return False
        
        logs = logs_response.json()
        backup_logs = [log for log in logs if log.get('action') == 'manual_backup']
        
        if len(backup_logs) == 0:
            print_test("Backup run", False, "No manual_backup activity log entry found")
            return False
        
        print_test("Backup run", True, f"Backup completed successfully with {len(stats)} collections backed up")
        return True
        
    except Exception as e:
        print_test("Backup run", False, f"Exception: {str(e)}")
        return False

def cleanup_reset_all():
    """Cleanup: Reset all settings to defaults"""
    print("\n" + "="*80)
    print("CLEANUP: Resetting all settings to defaults")
    print("="*80)
    
    try:
        response = requests.post(f"{BASE_URL}/settings/reset", json={})
        
        if response.status_code != 200:
            print("⚠️  WARNING: Could not reset settings to defaults")
            return False
        
        print("✅ Settings reset to defaults successfully")
        return True
        
    except Exception as e:
        print(f"⚠️  WARNING: Exception during cleanup: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("SETTINGS SYSTEM COMPREHENSIVE TEST SUITE")
    print("Testing 7 endpoints at:", BASE_URL)
    print("="*80)
    
    results = {}
    
    # Run all tests
    results['test_1_get_settings'] = test_get_settings()
    results['test_2_put_deep_merge'] = test_put_settings_deep_merge()
    results['test_3_reset_section'] = test_reset_section()
    results['test_4_reset_all'] = test_reset_all()
    results['test_5_whatsapp'] = test_whatsapp_integration()
    results['test_6_telegram'] = test_telegram_integration()
    results['test_7_backup'] = test_backup_run()
    
    # Cleanup
    cleanup_reset_all()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status} - {test_name}")
    
    print("\n" + "="*80)
    print(f"FINAL RESULT: {passed}/{total} tests passed")
    print("="*80)
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! Settings system is fully functional.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Review details above.")
        return 1

if __name__ == "__main__":
    exit(main())
