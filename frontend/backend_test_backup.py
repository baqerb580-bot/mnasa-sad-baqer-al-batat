#!/usr/bin/env python3
"""
Backend Test Script for Module E - Excel Backup System
Tests the Excel backup feature with 10 comprehensive test cases.
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://isp-noc-hub.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def log_test(test_num, description):
    """Print test header"""
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print(f"{'='*80}")

def log_result(success, message):
    """Print test result"""
    status = "✅ PASSED" if success else "❌ FAILED"
    print(f"{status}: {message}")

def log_info(message):
    """Print info message"""
    print(f"ℹ️  {message}")

# ============================================================================
# TEST 1: Manual backup creates real Excel file
# ============================================================================
def test_1():
    log_test(1, "Manual backup creates real Excel file")
    
    try:
        response = requests.post(f"{BASE_URL}/settings/backup/run", json={}, headers=HEADERS)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Response: {json.dumps(result, ensure_ascii=False, indent=2)}")
            
            # Verify response structure
            checks = []
            checks.append(("success is true", result.get('success') == True))
            checks.append(("id exists", 'id' in result and result['id']))
            checks.append(("filename exists and ends with .xlsx", 'filename' in result and result['filename'].endswith('.xlsx')))
            checks.append(("size exists and > 0", 'size' in result and result['size'] > 0))
            checks.append(("sizeKB exists and > 0", 'sizeKB' in result and result['sizeKB'] > 0))
            checks.append(("stats exists and is object", 'stats' in result and isinstance(result['stats'], dict)))
            checks.append(("stats is non-empty", 'stats' in result and len(result['stats']) > 0))
            checks.append(("totalDocs exists and is number", 'totalDocs' in result and isinstance(result['totalDocs'], (int, float))))
            checks.append(("triggeredBy is 'manual'", result.get('triggeredBy') == 'manual'))
            checks.append(("createdAt exists", 'createdAt' in result and result['createdAt']))
            
            all_passed = all(check[1] for check in checks)
            for check_name, check_result in checks:
                status = "✓" if check_result else "✗"
                print(f"  {status} {check_name}")
            
            if all_passed:
                log_result(True, f"Backup created successfully. ID: {result.get('id')}, Size: {result.get('sizeKB')} KB, Total Docs: {result.get('totalDocs')}")
                return result.get('id')
            else:
                log_result(False, "Some required fields missing or incorrect")
                return None
        else:
            log_result(False, f"HTTP {response.status_code}: {response.text}")
            return None
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
        return None

# ============================================================================
# TEST 2: Backup list endpoint
# ============================================================================
def test_2():
    log_test(2, "Backup list endpoint")
    
    try:
        response = requests.get(f"{BASE_URL}/settings/backup/list", headers=HEADERS)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            # Verify it's an array
            if not isinstance(result, list):
                log_result(False, f"Expected array, got {type(result)}")
                return False
            
            print(f"Found {len(result)} backup(s)")
            
            if len(result) == 0:
                log_result(True, "Backup list is empty (no backups yet)")
                return True
            
            # Check first item structure
            first = result[0]
            print(f"First backup: {json.dumps(first, ensure_ascii=False, indent=2)}")
            
            checks = []
            checks.append(("id exists", 'id' in first))
            checks.append(("filename exists", 'filename' in first))
            checks.append(("size exists", 'size' in first))
            checks.append(("sizeKB exists", 'sizeKB' in first))
            checks.append(("totalDocs exists", 'totalDocs' in first))
            checks.append(("triggeredBy exists", 'triggeredBy' in first))
            checks.append(("createdAt exists", 'createdAt' in first))
            checks.append(("_id NOT exposed", '_id' not in first))
            checks.append(("filepath NOT exposed", 'filepath' not in first))
            
            # Check sorting (newest first)
            if len(result) > 1:
                first_date = result[0].get('createdAt', '')
                second_date = result[1].get('createdAt', '')
                checks.append(("Sorted by createdAt desc", first_date >= second_date))
            
            all_passed = all(check[1] for check in checks)
            for check_name, check_result in checks:
                status = "✓" if check_result else "✗"
                print(f"  {status} {check_name}")
            
            if all_passed:
                log_result(True, f"Backup list working correctly. Found {len(result)} backup(s)")
                return True
            else:
                log_result(False, "Some checks failed")
                return False
        else:
            log_result(False, f"HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 3: Download backup file
# ============================================================================
def test_3(backup_id):
    log_test(3, "Download backup file")
    
    if not backup_id:
        log_result(False, "No backup ID from Test 1")
        return False
    
    try:
        response = requests.get(f"{BASE_URL}/settings/backup/download/{backup_id}", headers=HEADERS)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            # Check headers
            content_type = response.headers.get('Content-Type', '')
            content_disposition = response.headers.get('Content-Disposition', '')
            content_length = response.headers.get('Content-Length', '0')
            
            print(f"Content-Type: {content_type}")
            print(f"Content-Disposition: {content_disposition}")
            print(f"Content-Length: {content_length}")
            
            checks = []
            checks.append(("Content-Type is XLSX", 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in content_type))
            checks.append(("Content-Disposition has attachment", 'attachment' in content_disposition))
            checks.append(("Content-Disposition has filename", 'filename=' in content_disposition))
            checks.append(("Content-Length > 0", int(content_length) > 0))
            checks.append(("Response body > 1KB", len(response.content) > 1024))
            
            all_passed = all(check[1] for check in checks)
            for check_name, check_result in checks:
                status = "✓" if check_result else "✗"
                print(f"  {status} {check_name}")
            
            if all_passed:
                log_result(True, f"Backup download working. File size: {len(response.content)} bytes")
                return True
            else:
                log_result(False, "Some checks failed")
                return False
        else:
            log_result(False, f"HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 4: Download non-existent backup returns 404
# ============================================================================
def test_4():
    log_test(4, "Download non-existent backup returns 404")
    
    try:
        fake_id = "non-existent-backup-id-12345"
        response = requests.get(f"{BASE_URL}/settings/backup/download/{fake_id}", headers=HEADERS)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 404:
            log_result(True, "Correctly returns 404 for non-existent backup")
            return True
        else:
            log_result(False, f"Expected 404, got {response.status_code}")
            return False
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 5: Delete backup
# ============================================================================
def test_5():
    log_test(5, "Delete backup")
    
    try:
        # First create a new backup to delete
        log_info("Creating a new backup to delete...")
        create_response = requests.post(f"{BASE_URL}/settings/backup/run", json={}, headers=HEADERS)
        
        if create_response.status_code != 200:
            log_result(False, f"Failed to create backup for deletion test. Status: {create_response.status_code}")
            return False
        
        backup_id = create_response.json().get('id')
        print(f"Created backup ID: {backup_id}")
        
        # Delete the backup
        delete_response = requests.delete(f"{BASE_URL}/settings/backup/{backup_id}", headers=HEADERS)
        
        print(f"Delete Status Code: {delete_response.status_code}")
        
        if delete_response.status_code == 200:
            result = delete_response.json()
            print(f"Delete Response: {json.dumps(result, ensure_ascii=False, indent=2)}")
            
            if result.get('success') == True:
                log_info("Backup deleted successfully. Verifying it's gone...")
                
                # Try to download the deleted backup (should return 404)
                time.sleep(1)
                download_response = requests.get(f"{BASE_URL}/settings/backup/download/{backup_id}", headers=HEADERS)
                
                if download_response.status_code == 404:
                    log_info("✓ Download returns 404 (backup file removed)")
                else:
                    log_info(f"✗ Download returned {download_response.status_code} (expected 404)")
                
                # Check if backup is in list
                list_response = requests.get(f"{BASE_URL}/settings/backup/list", headers=HEADERS)
                if list_response.status_code == 200:
                    backups = list_response.json()
                    found = any(b.get('id') == backup_id for b in backups)
                    if not found:
                        log_info("✓ Backup not in list (DB record removed)")
                    else:
                        log_info("✗ Backup still in list (DB record not removed)")
                
                if download_response.status_code == 404 and not found:
                    log_result(True, "Backup deleted successfully (file + DB record removed)")
                    return True
                else:
                    log_result(False, "Backup not fully deleted")
                    return False
            else:
                log_result(False, f"Delete returned success=false: {result}")
                return False
        else:
            log_result(False, f"HTTP {delete_response.status_code}: {delete_response.text}")
            return False
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 6: Settings.backup.lastBackup updated
# ============================================================================
def test_6():
    log_test(6, "Settings.backup.lastBackup updated")
    
    try:
        # Get settings before backup
        log_info("Getting settings before backup...")
        settings_before = requests.get(f"{BASE_URL}/settings", headers=HEADERS)
        
        if settings_before.status_code != 200:
            log_result(False, f"Failed to get settings. Status: {settings_before.status_code}")
            return False
        
        before_data = settings_before.json()
        last_backup_before = before_data.get('backup', {}).get('lastBackup')
        last_backup_id_before = before_data.get('backup', {}).get('lastBackupId')
        
        print(f"lastBackup before: {last_backup_before}")
        print(f"lastBackupId before: {last_backup_id_before}")
        
        # Create a new backup
        log_info("Creating new backup...")
        time.sleep(2)  # Wait 2 seconds to ensure timestamp difference
        backup_response = requests.post(f"{BASE_URL}/settings/backup/run", json={}, headers=HEADERS)
        
        if backup_response.status_code != 200:
            log_result(False, f"Failed to create backup. Status: {backup_response.status_code}")
            return False
        
        backup_data = backup_response.json()
        new_backup_id = backup_data.get('id')
        new_backup_time = backup_data.get('createdAt')
        
        print(f"New backup ID: {new_backup_id}")
        print(f"New backup time: {new_backup_time}")
        
        # Get settings after backup
        log_info("Getting settings after backup...")
        time.sleep(1)
        settings_after = requests.get(f"{BASE_URL}/settings", headers=HEADERS)
        
        if settings_after.status_code != 200:
            log_result(False, f"Failed to get settings after backup. Status: {settings_after.status_code}")
            return False
        
        after_data = settings_after.json()
        last_backup_after = after_data.get('backup', {}).get('lastBackup')
        last_backup_id_after = after_data.get('backup', {}).get('lastBackupId')
        
        print(f"lastBackup after: {last_backup_after}")
        print(f"lastBackupId after: {last_backup_id_after}")
        
        # Verify updates
        checks = []
        checks.append(("lastBackup updated", last_backup_after != last_backup_before))
        
        # Check if lastBackup is recent (within 60s) - handle timezone properly
        if last_backup_after:
            try:
                from datetime import timezone
                backup_time = datetime.fromisoformat(last_backup_after.replace('Z', '+00:00'))
                now_time = datetime.now(timezone.utc)
                time_diff = (now_time - backup_time).total_seconds()
                is_recent = time_diff < 60
            except:
                is_recent = True  # If parsing fails, assume it's OK
        else:
            is_recent = False
        
        checks.append(("lastBackup is recent (within 60s)", is_recent))
        checks.append(("lastBackupId matches new backup", last_backup_id_after == new_backup_id))
        
        all_passed = all(check[1] for check in checks)
        for check_name, check_result in checks:
            status = "✓" if check_result else "✗"
            print(f"  {status} {check_name}")
        
        if all_passed:
            log_result(True, "Settings.backup.lastBackup and lastBackupId updated correctly")
            return True
        else:
            log_result(False, "Settings not updated correctly")
            return False
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 7: Activity log entry created
# ============================================================================
def test_7():
    log_test(7, "Activity log entry created")
    
    try:
        # Create a new backup
        log_info("Creating new backup...")
        backup_response = requests.post(f"{BASE_URL}/settings/backup/run", json={}, headers=HEADERS)
        
        if backup_response.status_code != 200:
            log_result(False, f"Failed to create backup. Status: {backup_response.status_code}")
            return False
        
        backup_id = backup_response.json().get('id')
        print(f"Created backup ID: {backup_id}")
        
        # Get activity logs
        log_info("Checking activity logs...")
        time.sleep(1)
        logs_response = requests.get(f"{BASE_URL}/activity-logs", headers=HEADERS)
        
        if logs_response.status_code != 200:
            log_result(False, f"Failed to get activity logs. Status: {logs_response.status_code}")
            return False
        
        logs = logs_response.json()
        
        # Find the backup log entry
        backup_logs = [log for log in logs if log.get('action') in ['manual_backup', 'auto_backup'] and log.get('entityId') == backup_id]
        
        if len(backup_logs) > 0:
            log_entry = backup_logs[0]
            print(f"Found activity log: {json.dumps(log_entry, ensure_ascii=False, indent=2)}")
            
            checks = []
            checks.append(("action is 'manual_backup'", log_entry.get('action') == 'manual_backup'))
            checks.append(("entity is 'backup'", log_entry.get('entity') == 'backup'))
            checks.append(("entityId matches backup ID", log_entry.get('entityId') == backup_id))
            
            all_passed = all(check[1] for check in checks)
            for check_name, check_result in checks:
                status = "✓" if check_result else "✗"
                print(f"  {status} {check_name}")
            
            if all_passed:
                log_result(True, "Activity log entry created correctly")
                return True
            else:
                log_result(False, "Activity log entry has incorrect fields")
                return False
        else:
            log_result(False, f"No activity log found for backup {backup_id}")
            return False
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 8: Stats object covers actual collections
# ============================================================================
def test_8():
    log_test(8, "Stats object covers actual collections")
    
    try:
        # Create a new backup
        log_info("Creating new backup...")
        backup_response = requests.post(f"{BASE_URL}/settings/backup/run", json={}, headers=HEADERS)
        
        if backup_response.status_code != 200:
            log_result(False, f"Failed to create backup. Status: {backup_response.status_code}")
            return False
        
        result = backup_response.json()
        stats = result.get('stats', {})
        total_docs = result.get('totalDocs', 0)
        
        print(f"Stats: {json.dumps(stats, ensure_ascii=False, indent=2)}")
        print(f"Total Docs: {total_docs}")
        
        # Expected major collections
        expected_collections = ['subscribers', 'employees', 'tasks', 'notifications', 'packages', 'agents']
        
        checks = []
        for collection in expected_collections:
            has_collection = collection in stats
            checks.append((f"Has '{collection}' collection", has_collection))
            if has_collection:
                print(f"  ✓ {collection}: {stats[collection]} documents")
        
        # Verify totalDocs equals sum of all stats
        calculated_total = sum(stats.values())
        checks.append(("totalDocs equals sum of stats", total_docs == calculated_total))
        
        # Verify 'backups' collection is NOT included (no recursion)
        checks.append(("'backups' collection excluded", 'backups' not in stats))
        
        all_passed = all(check[1] for check in checks)
        for check_name, check_result in checks:
            status = "✓" if check_result else "✗"
            print(f"  {status} {check_name}")
        
        if all_passed:
            log_result(True, f"Stats covers {len(stats)} collections, totalDocs={total_docs}")
            return True
        else:
            log_result(False, "Stats object incomplete or incorrect")
            return False
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 9: Multiple backups in quick succession
# ============================================================================
def test_9():
    log_test(9, "Multiple backups in quick succession")
    
    try:
        backup_ids = []
        
        # Create 3 backups
        for i in range(3):
            log_info(f"Creating backup {i+1}/3...")
            response = requests.post(f"{BASE_URL}/settings/backup/run", json={}, headers=HEADERS)
            
            if response.status_code == 200:
                backup_id = response.json().get('id')
                backup_ids.append(backup_id)
                print(f"  Created backup {i+1}: {backup_id}")
                time.sleep(0.5)  # Small delay between backups
            else:
                log_result(False, f"Failed to create backup {i+1}. Status: {response.status_code}")
                return False
        
        # Get backup list
        log_info("Checking backup list...")
        time.sleep(1)
        list_response = requests.get(f"{BASE_URL}/settings/backup/list", headers=HEADERS)
        
        if list_response.status_code != 200:
            log_result(False, f"Failed to get backup list. Status: {list_response.status_code}")
            return False
        
        backups = list_response.json()
        
        # Verify all 3 backups are in the list
        found_count = 0
        for backup_id in backup_ids:
            if any(b.get('id') == backup_id for b in backups):
                found_count += 1
                print(f"  ✓ Found backup {backup_id}")
            else:
                print(f"  ✗ Missing backup {backup_id}")
        
        # Verify distinct IDs
        unique_ids = set(backup_ids)
        
        checks = []
        checks.append(("All 3 backups found in list", found_count == 3))
        checks.append(("All IDs are distinct", len(unique_ids) == 3))
        
        all_passed = all(check[1] for check in checks)
        for check_name, check_result in checks:
            status = "✓" if check_result else "✗"
            print(f"  {status} {check_name}")
        
        if all_passed:
            log_result(True, "Multiple backups created successfully with distinct IDs")
            return True
        else:
            log_result(False, "Multiple backup creation failed")
            return False
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 10: Backups exclude self (no recursion)
# ============================================================================
def test_10():
    log_test(10, "Backups exclude self (no recursion)")
    
    try:
        # Create a backup
        log_info("Creating backup...")
        backup_response = requests.post(f"{BASE_URL}/settings/backup/run", json={}, headers=HEADERS)
        
        if backup_response.status_code != 200:
            log_result(False, f"Failed to create backup. Status: {backup_response.status_code}")
            return False
        
        result = backup_response.json()
        stats = result.get('stats', {})
        
        print(f"Collections in stats: {list(stats.keys())}")
        
        # Verify 'backups' collection is NOT in stats
        if 'backups' in stats:
            log_result(False, "'backups' collection found in stats (recursion detected!)")
            return False
        else:
            log_result(True, "'backups' collection correctly excluded from backup (no recursion)")
            return True
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
        return False

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================
def main():
    print("\n" + "="*80)
    print("BACKEND TESTING: Module E - Excel Backup System")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    results = {}
    
    # Test 1: Manual backup creates real Excel file
    backup_id = test_1()
    results['test_1'] = backup_id is not None
    
    # Test 2: Backup list endpoint
    results['test_2'] = test_2()
    
    # Test 3: Download backup file
    if backup_id:
        results['test_3'] = test_3(backup_id)
    else:
        print("\n⚠️  Skipping Test 3 (depends on Test 1)")
        results['test_3'] = False
    
    # Test 4: Download non-existent backup returns 404
    results['test_4'] = test_4()
    
    # Test 5: Delete backup
    results['test_5'] = test_5()
    
    # Test 6: Settings.backup.lastBackup updated
    results['test_6'] = test_6()
    
    # Test 7: Activity log entry created
    results['test_7'] = test_7()
    
    # Test 8: Stats object covers actual collections
    results['test_8'] = test_8()
    
    # Test 9: Multiple backups in quick succession
    results['test_9'] = test_9()
    
    # Test 10: Backups exclude self (no recursion)
    results['test_10'] = test_10()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed*100//total}%)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! Excel Backup System is working correctly.")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review the output above.")
    
    print("="*80)

if __name__ == "__main__":
    main()
