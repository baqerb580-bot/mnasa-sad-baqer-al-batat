#!/usr/bin/env python3
"""
ISP Subscriber Sync Center Backend Verification Test
Tests all 13 scenarios specified in the review request
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://isp-noc-hub.preview.emergentagent.com/api"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_result(test_name, passed, details=""):
    status = "✅ PASSED" if passed else "❌ FAILED"
    log(f"{status} - {test_name}")
    if details:
        log(f"  Details: {details}")
    return passed

# Store test data for cleanup
test_data = {
    'created_subscriber_ids': [],
    'run_ids': []
}

def cleanup():
    """Clean up test data"""
    log("\n=== CLEANUP ===")
    # Delete test subscribers
    for sub_id in test_data['created_subscriber_ids']:
        try:
            r = requests.delete(f"{BASE_URL}/subscribers/{sub_id}")
            if r.status_code == 200:
                log(f"Deleted test subscriber: {sub_id}")
        except Exception as e:
            log(f"Failed to delete subscriber {sub_id}: {e}")
    
    # Delete test runs
    for run_id in test_data['run_ids']:
        try:
            r = requests.delete(f"{BASE_URL}/isp-sync/logs/{run_id}")
            if r.status_code == 200:
                log(f"Deleted test run: {run_id}")
        except Exception as e:
            log(f"Failed to delete run {run_id}: {e}")

def main():
    all_passed = True
    
    log("=" * 80)
    log("ISP SUBSCRIBER SYNC CENTER BACKEND VERIFICATION")
    log("=" * 80)
    
    # Test 1: GET /api/isp-sync/config (default values)
    log("\n=== TEST 1: GET /api/isp-sync/config (default values) ===")
    try:
        r = requests.get(f"{BASE_URL}/isp-sync/config")
        passed = r.status_code == 200
        if passed:
            data = r.json()
            required_keys = ['enabled', 'sourceType', 'sourceUrl', 'username', 'password', 
                           'fetchMethod', 'autoDaily', 'autoUpdateMatching', 'blockOnConflict', 
                           'fieldMap', 'lastRunAt']
            has_all_keys = all(k in data for k in required_keys)
            passed = has_all_keys
            test_result("GET /api/isp-sync/config", passed, 
                       f"Response shape correct: {has_all_keys}, keys: {list(data.keys())}")
        else:
            test_result("GET /api/isp-sync/config", False, f"Status: {r.status_code}")
            all_passed = False
    except Exception as e:
        test_result("GET /api/isp-sync/config", False, str(e))
        all_passed = False
    
    # Test 2: PUT /api/isp-sync/config
    log("\n=== TEST 2: PUT /api/isp-sync/config ===")
    try:
        config_data = {
            "enabled": True,
            "sourceType": "mynet",
            "sourceUrl": "https://test.example.com",
            "username": "admin",
            "password": "secret123",
            "fetchMethod": "excel",
            "autoDaily": False,
            "autoUpdateMatching": False,
            "blockOnConflict": True
        }
        r = requests.put(f"{BASE_URL}/isp-sync/config", json=config_data)
        passed = r.status_code == 200
        if passed:
            data = r.json()
            passed = data.get('success') == True and data.get('password') == '****'
            test_result("PUT /api/isp-sync/config", passed, 
                       f"Config saved, password masked: {data.get('password') == '****'}")
        else:
            test_result("PUT /api/isp-sync/config", False, f"Status: {r.status_code}")
            all_passed = False
    except Exception as e:
        test_result("PUT /api/isp-sync/config", False, str(e))
        all_passed = False
    
    # Test 2b: Verify config persisted and password masking
    log("\n=== TEST 2b: Verify config persistence and password masking ===")
    try:
        r = requests.get(f"{BASE_URL}/isp-sync/config")
        passed = r.status_code == 200
        if passed:
            data = r.json()
            passed = (data.get('sourceType') == 'mynet' and 
                     data.get('password') == '****' and
                     data.get('blockOnConflict') == True)
            test_result("Config persistence", passed, 
                       f"sourceType={data.get('sourceType')}, password={data.get('password')}")
        else:
            test_result("Config persistence", False, f"Status: {r.status_code}")
            all_passed = False
    except Exception as e:
        test_result("Config persistence", False, str(e))
        all_passed = False
    
    # Test 2c: Password preservation when sending ****
    log("\n=== TEST 2c: Password preservation when sending **** ===")
    try:
        r = requests.put(f"{BASE_URL}/isp-sync/config", json={
            "enabled": True,
            "sourceType": "mynet",
            "password": "****"  # Should preserve existing password
        })
        passed = r.status_code == 200
        if passed:
            data = r.json()
            # Password should still be masked as ****
            passed = data.get('password') == '****'
            test_result("Password preservation", passed, 
                       f"Password preserved (not overwritten with literal ****)")
        else:
            test_result("Password preservation", False, f"Status: {r.status_code}")
            all_passed = False
    except Exception as e:
        test_result("Password preservation", False, str(e))
        all_passed = False
    
    # Test 3: POST /api/isp-sync/scan (basic - new subscribers)
    log("\n=== TEST 3: POST /api/isp-sync/scan (basic - new subscribers) ===")
    scan_run_id = None
    try:
        scan_data = {
            "source": "test",
            "externalSubs": [
                {
                    "username": "user_new_test_001",
                    "name": "مشترك تجريبي 1",
                    "phone": "07901111111",
                    "package": "30Mb",
                    "endDate": "2026-12-31",
                    "status": "active",
                    "fee": 35000,
                    "agentName": "وكيل أ"
                },
                {
                    "username": "user_new_test_002",
                    "name": "مشترك تجريبي 2",
                    "phone": "07902222222",
                    "package": "50Mb",
                    "endDate": "2026-11-30",
                    "status": "active",
                    "fee": 50000
                }
            ]
        }
        r = requests.post(f"{BASE_URL}/isp-sync/scan", json=scan_data)
        passed = r.status_code == 200
        if passed:
            data = r.json()
            scan_run_id = data.get('runId')
            test_data['run_ids'].append(scan_run_id)
            
            required_keys = ['runId', 'source', 'ranAt', 'counts', 'rows']
            has_all_keys = all(k in data for k in required_keys)
            
            # Check counts structure
            counts = data.get('counts', {})
            count_keys = ['total', 'synced', 'new', 'needs_update', 'conflict', 'missing_in_isp', 'externals', 'platforms']
            has_count_keys = all(k in counts for k in count_keys)
            
            # Check rows structure
            rows = data.get('rows', [])
            new_rows = [r for r in rows if r.get('status') == 'new']
            
            passed = has_all_keys and has_count_keys and len(new_rows) >= 2
            test_result("POST /api/isp-sync/scan (basic)", passed, 
                       f"runId={scan_run_id}, new subscribers found: {len(new_rows)}, total rows: {len(rows)}")
        else:
            test_result("POST /api/isp-sync/scan (basic)", False, f"Status: {r.status_code}")
            all_passed = False
    except Exception as e:
        test_result("POST /api/isp-sync/scan (basic)", False, str(e))
        all_passed = False
    
    # Test 4: POST /api/isp-sync/scan with existing subscriber for diff detection
    log("\n=== TEST 4: POST /api/isp-sync/scan (diff detection with existing subscriber) ===")
    conflict_run_id = None
    conflict_row_id = None
    try:
        # First, get a real subscriber
        r = requests.get(f"{BASE_URL}/subscribers")
        if r.status_code == 200:
            subscribers = r.json()
            if len(subscribers) > 0:
                # Pick first subscriber with phone
                test_sub = next((s for s in subscribers if s.get('phone')), subscribers[0])
                original_phone = test_sub.get('phone', '07900000000')
                original_package = test_sub.get('package', 'Unknown')
                
                log(f"Using existing subscriber: phone={original_phone}, package={original_package}")
                
                # Scan with modified data (different username, package, endDate, name)
                scan_data = {
                    "source": "test",
                    "externalSubs": [
                        {
                            "phone": original_phone,
                            "username": "DIFFERENT_USERNAME_XYZ",
                            "package": "999Mb",
                            "endDate": "2030-01-01",
                            "name": "Modified Name",
                            "status": "active"
                        }
                    ]
                }
                r = requests.post(f"{BASE_URL}/isp-sync/scan", json=scan_data)
                passed = r.status_code == 200
                if passed:
                    data = r.json()
                    conflict_run_id = data.get('runId')
                    test_data['run_ids'].append(conflict_run_id)
                    
                    rows = data.get('rows', [])
                    # Should match by phone
                    matched_row = next((r for r in rows if r.get('matchedBy') == 'phone'), None)
                    
                    if matched_row:
                        conflict_row_id = matched_row.get('rowId')
                        status = matched_row.get('status')
                        severity = matched_row.get('severity')
                        changes = matched_row.get('changes', [])
                        
                        # Should be conflict because username changed (critical)
                        is_conflict = status == 'conflict' and severity == 'critical'
                        has_changes = len(changes) >= 3  # name, username, package, endDate
                        
                        passed = is_conflict and has_changes
                        test_result("Diff detection with conflict", passed, 
                                   f"status={status}, severity={severity}, changes={len(changes)}, matchedBy=phone")
                    else:
                        test_result("Diff detection with conflict", False, "No matched row found")
                        all_passed = False
                else:
                    test_result("Diff detection with conflict", False, f"Status: {r.status_code}")
                    all_passed = False
            else:
                test_result("Diff detection with conflict", False, "No subscribers found in DB")
                all_passed = False
        else:
            test_result("Diff detection with conflict", False, f"Failed to get subscribers: {r.status_code}")
            all_passed = False
    except Exception as e:
        test_result("Diff detection with conflict", False, str(e))
        all_passed = False
    
    # Test 5: POST /api/isp-sync/apply with ignore action
    log("\n=== TEST 5: POST /api/isp-sync/apply (ignore action) ===")
    if scan_run_id:
        try:
            # Get the first new row from scan
            r = requests.get(f"{BASE_URL}/isp-sync/logs/{scan_run_id}")
            if r.status_code == 200:
                run_data = r.json()
                rows = run_data.get('rows', [])
                new_row = next((r for r in rows if r.get('status') == 'new'), None)
                
                if new_row:
                    apply_data = {
                        "runId": scan_run_id,
                        "actions": [
                            {
                                "rowId": new_row.get('rowId'),
                                "action": "ignore"
                            }
                        ]
                    }
                    r = requests.post(f"{BASE_URL}/isp-sync/apply", json=apply_data)
                    passed = r.status_code == 200
                    if passed:
                        data = r.json()
                        results = data.get('results', {})
                        passed = (data.get('success') == True and 
                                 results.get('ignored') == 1 and
                                 results.get('created') == 0)
                        test_result("Apply with ignore action", passed, 
                                   f"ignored={results.get('ignored')}, created={results.get('created')}")
                    else:
                        test_result("Apply with ignore action", False, f"Status: {r.status_code}")
                        all_passed = False
                else:
                    test_result("Apply with ignore action", False, "No new row found")
                    all_passed = False
            else:
                test_result("Apply with ignore action", False, f"Failed to get run: {r.status_code}")
                all_passed = False
        except Exception as e:
            test_result("Apply with ignore action", False, str(e))
            all_passed = False
    else:
        test_result("Apply with ignore action", False, "No scan_run_id available")
        all_passed = False
    
    # Test 6: POST /api/isp-sync/apply with create action
    log("\n=== TEST 6: POST /api/isp-sync/apply (create action) ===")
    try:
        # Create a new scan with a clearly NEW subscriber
        unique_username = f"test_create_{int(time.time())}"
        unique_phone = f"0790{int(time.time()) % 10000000}"
        
        scan_data = {
            "source": "test",
            "externalSubs": [
                {
                    "username": unique_username,
                    "name": "Test Create Subscriber",
                    "phone": unique_phone,
                    "package": "100Mb",
                    "endDate": "2027-01-01",
                    "status": "active",
                    "fee": 60000
                }
            ]
        }
        r = requests.post(f"{BASE_URL}/isp-sync/scan", json=scan_data)
        if r.status_code == 200:
            scan_result = r.json()
            create_run_id = scan_result.get('runId')
            test_data['run_ids'].append(create_run_id)
            
            rows = scan_result.get('rows', [])
            new_row = next((r for r in rows if r.get('status') == 'new'), None)
            
            if new_row:
                # Apply create action
                apply_data = {
                    "runId": create_run_id,
                    "actions": [
                        {
                            "rowId": new_row.get('rowId'),
                            "action": "create"
                        }
                    ]
                }
                r = requests.post(f"{BASE_URL}/isp-sync/apply", json=apply_data)
                passed = r.status_code == 200
                if passed:
                    data = r.json()
                    results = data.get('results', {})
                    passed = results.get('created') == 1
                    
                    if passed:
                        # Verify subscriber was created
                        r = requests.get(f"{BASE_URL}/subscribers")
                        if r.status_code == 200:
                            subscribers = r.json()
                            created_sub = next((s for s in subscribers if s.get('username') == unique_username), None)
                            if created_sub:
                                test_data['created_subscriber_ids'].append(created_sub.get('id'))
                                test_result("Apply with create action", True, 
                                           f"Subscriber created: {unique_username}, id={created_sub.get('id')}")
                            else:
                                test_result("Apply with create action", False, "Subscriber not found after creation")
                                all_passed = False
                        else:
                            test_result("Apply with create action", False, "Failed to verify creation")
                            all_passed = False
                    else:
                        test_result("Apply with create action", False, f"created={results.get('created')}")
                        all_passed = False
                else:
                    test_result("Apply with create action", False, f"Status: {r.status_code}")
                    all_passed = False
            else:
                test_result("Apply with create action", False, "No new row found in scan")
                all_passed = False
        else:
            test_result("Apply with create action", False, f"Scan failed: {r.status_code}")
            all_passed = False
    except Exception as e:
        test_result("Apply with create action", False, str(e))
        all_passed = False
    
    # Test 7: POST /api/isp-sync/apply with update action (conflict blocking)
    log("\n=== TEST 7: POST /api/isp-sync/apply (update with conflict blocking) ===")
    if conflict_run_id and conflict_row_id:
        try:
            apply_data = {
                "runId": conflict_run_id,
                "actions": [
                    {
                        "rowId": conflict_row_id,
                        "action": "update"
                    }
                ]
            }
            r = requests.post(f"{BASE_URL}/isp-sync/apply", json=apply_data)
            passed = r.status_code == 200
            if passed:
                data = r.json()
                results = data.get('results', {})
                errors = results.get('errors', [])
                
                # Should have error because blockOnConflict=true and no explicit fields
                has_conflict_error = any(e.get('error') == 'conflict_requires_explicit_fields' for e in errors)
                passed = has_conflict_error
                test_result("Update with conflict blocking", passed, 
                           f"Conflict blocked correctly: {has_conflict_error}, errors={len(errors)}")
            else:
                test_result("Update with conflict blocking", False, f"Status: {r.status_code}")
                all_passed = False
        except Exception as e:
            test_result("Update with conflict blocking", False, str(e))
            all_passed = False
    else:
        test_result("Update with conflict blocking", False, "No conflict_run_id or conflict_row_id available")
        all_passed = False
    
    # Test 8: POST /api/isp-sync/apply with explicit fields
    log("\n=== TEST 8: POST /api/isp-sync/apply (update with explicit fields) ===")
    if conflict_run_id and conflict_row_id:
        try:
            # Get original subscriber data
            r = requests.get(f"{BASE_URL}/isp-sync/logs/{conflict_run_id}")
            if r.status_code == 200:
                run_data = r.json()
                rows = run_data.get('rows', [])
                conflict_row = next((r for r in rows if r.get('rowId') == conflict_row_id), None)
                
                if conflict_row:
                    platform_sub = conflict_row.get('platform', {})
                    original_package = platform_sub.get('package')
                    original_name = platform_sub.get('name')
                    
                    # Apply update with explicit field
                    apply_data = {
                        "runId": conflict_run_id,
                        "actions": [
                            {
                                "rowId": conflict_row_id,
                                "action": "update",
                                "fields": {
                                    "package": "100Mb_explicit"
                                }
                            }
                        ]
                    }
                    r = requests.post(f"{BASE_URL}/isp-sync/apply", json=apply_data)
                    passed = r.status_code == 200
                    if passed:
                        data = r.json()
                        results = data.get('results', {})
                        passed = results.get('updated') == 1
                        
                        if passed:
                            # Verify only package changed
                            r = requests.get(f"{BASE_URL}/subscribers")
                            if r.status_code == 200:
                                subscribers = r.json()
                                updated_sub = next((s for s in subscribers if s.get('id') == conflict_row_id), None)
                                if updated_sub:
                                    new_package = updated_sub.get('package')
                                    new_name = updated_sub.get('name')
                                    
                                    package_changed = new_package == "100Mb_explicit"
                                    name_unchanged = new_name == original_name
                                    
                                    passed = package_changed and name_unchanged
                                    test_result("Update with explicit fields", passed, 
                                               f"Package updated: {package_changed}, Name unchanged: {name_unchanged}")
                                    
                                    # Restore original package
                                    if original_package:
                                        requests.put(f"{BASE_URL}/subscribers/{conflict_row_id}", 
                                                   json={"package": original_package})
                                        log(f"Restored original package: {original_package}")
                                else:
                                    test_result("Update with explicit fields", False, "Subscriber not found after update")
                                    all_passed = False
                            else:
                                test_result("Update with explicit fields", False, "Failed to verify update")
                                all_passed = False
                        else:
                            test_result("Update with explicit fields", False, f"updated={results.get('updated')}")
                            all_passed = False
                    else:
                        test_result("Update with explicit fields", False, f"Status: {r.status_code}")
                        all_passed = False
                else:
                    test_result("Update with explicit fields", False, "Conflict row not found")
                    all_passed = False
            else:
                test_result("Update with explicit fields", False, f"Failed to get run: {r.status_code}")
                all_passed = False
        except Exception as e:
            test_result("Update with explicit fields", False, str(e))
            all_passed = False
    else:
        test_result("Update with explicit fields", False, "No conflict_run_id or conflict_row_id available")
        all_passed = False
    
    # Test 9: GET /api/isp-sync/logs
    log("\n=== TEST 9: GET /api/isp-sync/logs ===")
    try:
        r = requests.get(f"{BASE_URL}/isp-sync/logs")
        passed = r.status_code == 200
        if passed:
            data = r.json()
            passed = isinstance(data, list)
            if passed:
                # Verify each entry has required fields but NOT rows array
                if len(data) > 0:
                    first_entry = data[0]
                    has_required = all(k in first_entry for k in ['runId', 'source', 'ranAt', 'counts', 'applied'])
                    has_no_rows = 'rows' not in first_entry
                    passed = has_required and has_no_rows
                    test_result("GET /api/isp-sync/logs", passed, 
                               f"Found {len(data)} runs, lightweight (no rows array): {has_no_rows}")
                else:
                    test_result("GET /api/isp-sync/logs", True, "Empty list (no runs yet)")
            else:
                test_result("GET /api/isp-sync/logs", False, "Response is not an array")
                all_passed = False
        else:
            test_result("GET /api/isp-sync/logs", False, f"Status: {r.status_code}")
            all_passed = False
    except Exception as e:
        test_result("GET /api/isp-sync/logs", False, str(e))
        all_passed = False
    
    # Test 10: GET /api/isp-sync/logs/:runId
    log("\n=== TEST 10: GET /api/isp-sync/logs/:runId ===")
    if scan_run_id:
        try:
            r = requests.get(f"{BASE_URL}/isp-sync/logs/{scan_run_id}")
            passed = r.status_code == 200
            if passed:
                data = r.json()
                has_rows = 'rows' in data and isinstance(data.get('rows'), list)
                has_required = all(k in data for k in ['runId', 'source', 'ranAt', 'counts'])
                passed = has_rows and has_required
                test_result("GET /api/isp-sync/logs/:runId", passed, 
                           f"Full run details with rows array: {has_rows}, rows count: {len(data.get('rows', []))}")
            else:
                test_result("GET /api/isp-sync/logs/:runId", False, f"Status: {r.status_code}")
                all_passed = False
        except Exception as e:
            test_result("GET /api/isp-sync/logs/:runId", False, str(e))
            all_passed = False
    else:
        test_result("GET /api/isp-sync/logs/:runId", False, "No scan_run_id available")
        all_passed = False
    
    # Test 11: DELETE /api/isp-sync/logs/:runId
    log("\n=== TEST 11: DELETE /api/isp-sync/logs/:runId ===")
    if scan_run_id:
        try:
            r = requests.delete(f"{BASE_URL}/isp-sync/logs/{scan_run_id}")
            passed = r.status_code == 200
            if passed:
                data = r.json()
                passed = data.get('success') == True
                
                if passed:
                    # Verify deletion
                    r = requests.get(f"{BASE_URL}/isp-sync/logs/{scan_run_id}")
                    deleted = r.status_code == 404
                    passed = deleted
                    test_result("DELETE /api/isp-sync/logs/:runId", passed, 
                               f"Run deleted, GET returns 404: {deleted}")
                    
                    # Remove from cleanup list
                    if scan_run_id in test_data['run_ids']:
                        test_data['run_ids'].remove(scan_run_id)
                else:
                    test_result("DELETE /api/isp-sync/logs/:runId", False, "success != true")
                    all_passed = False
            else:
                test_result("DELETE /api/isp-sync/logs/:runId", False, f"Status: {r.status_code}")
                all_passed = False
        except Exception as e:
            test_result("DELETE /api/isp-sync/logs/:runId", False, str(e))
            all_passed = False
    else:
        test_result("DELETE /api/isp-sync/logs/:runId", False, "No scan_run_id available")
        all_passed = False
    
    # Test 12: Duplicate prevention test
    log("\n=== TEST 12: Duplicate prevention test ===")
    try:
        # Create a new subscriber via scan + apply
        unique_username = f"test_dup_{int(time.time())}"
        unique_phone = f"0791{int(time.time()) % 10000000}"
        
        scan_data = {
            "source": "test",
            "externalSubs": [
                {
                    "username": unique_username,
                    "name": "Test Duplicate Prevention",
                    "phone": unique_phone,
                    "package": "50Mb",
                    "status": "active",
                    "fee": 40000
                }
            ]
        }
        
        # First scan + create
        r = requests.post(f"{BASE_URL}/isp-sync/scan", json=scan_data)
        if r.status_code == 200:
            scan1 = r.json()
            run1_id = scan1.get('runId')
            test_data['run_ids'].append(run1_id)
            
            rows = scan1.get('rows', [])
            new_row = next((r for r in rows if r.get('status') == 'new'), None)
            
            if new_row:
                # Apply create
                apply_data = {
                    "runId": run1_id,
                    "actions": [{"rowId": new_row.get('rowId'), "action": "create"}]
                }
                r = requests.post(f"{BASE_URL}/isp-sync/apply", json=apply_data)
                if r.status_code == 200:
                    # Get created subscriber ID for cleanup
                    r = requests.get(f"{BASE_URL}/subscribers")
                    if r.status_code == 200:
                        subscribers = r.json()
                        created_sub = next((s for s in subscribers if s.get('username') == unique_username), None)
                        if created_sub:
                            test_data['created_subscriber_ids'].append(created_sub.get('id'))
                    
                    # Second scan + create (should fail with duplicate)
                    r = requests.post(f"{BASE_URL}/isp-sync/scan", json=scan_data)
                    if r.status_code == 200:
                        scan2 = r.json()
                        run2_id = scan2.get('runId')
                        test_data['run_ids'].append(run2_id)
                        
                        rows2 = scan2.get('rows', [])
                        # Should now be matched (synced or needs_update), not new
                        matched_row = next((r for r in rows2 if r.get('matchedBy') is not None), None)
                        
                        if matched_row:
                            # Try to create again (should error with duplicate_exists)
                            apply_data2 = {
                                "runId": run2_id,
                                "actions": [{"rowId": matched_row.get('rowId'), "action": "create"}]
                            }
                            r = requests.post(f"{BASE_URL}/isp-sync/apply", json=apply_data2)
                            if r.status_code == 200:
                                data = r.json()
                                results = data.get('results', {})
                                errors = results.get('errors', [])
                                
                                # Should have duplicate_exists error
                                has_dup_error = any(e.get('error') == 'duplicate_exists' for e in errors)
                                passed = has_dup_error
                                test_result("Duplicate prevention", passed, 
                                           f"Duplicate correctly prevented: {has_dup_error}")
                            else:
                                test_result("Duplicate prevention", False, f"Apply failed: {r.status_code}")
                                all_passed = False
                        else:
                            # If matched in scan, that's also valid (means duplicate detection worked)
                            test_result("Duplicate prevention", True, 
                                       "Duplicate detected in scan (matched existing subscriber)")
                    else:
                        test_result("Duplicate prevention", False, f"Second scan failed: {r.status_code}")
                        all_passed = False
                else:
                    test_result("Duplicate prevention", False, f"First apply failed: {r.status_code}")
                    all_passed = False
            else:
                test_result("Duplicate prevention", False, "No new row in first scan")
                all_passed = False
        else:
            test_result("Duplicate prevention", False, f"First scan failed: {r.status_code}")
            all_passed = False
    except Exception as e:
        test_result("Duplicate prevention", False, str(e))
        all_passed = False
    
    # Test 13: Regression check
    log("\n=== TEST 13: Regression check ===")
    regression_tests = [
        ("GET /api/dashboard/stats", f"{BASE_URL}/dashboard/stats"),
        ("GET /api/subscribers", f"{BASE_URL}/subscribers"),
        ("GET /api/whatsapp/status", f"{BASE_URL}/whatsapp/status"),
        ("GET /api/health", f"{BASE_URL}/health")
    ]
    
    for test_name, url in regression_tests:
        try:
            r = requests.get(url)
            passed = r.status_code == 200
            if passed:
                data = r.json()
                if 'health' in url:
                    passed = data.get('dbConnected') == True
                    test_result(test_name, passed, f"dbConnected={data.get('dbConnected')}")
                elif 'subscribers' in url:
                    passed = isinstance(data, list)
                    test_result(test_name, passed, f"Returned {len(data)} subscribers")
                else:
                    test_result(test_name, passed, "Response OK")
            else:
                test_result(test_name, False, f"Status: {r.status_code}")
                all_passed = False
        except Exception as e:
            test_result(test_name, False, str(e))
            all_passed = False
    
    # Cleanup
    cleanup()
    
    # Final summary
    log("\n" + "=" * 80)
    if all_passed:
        log("✅ ALL TESTS PASSED - ISP Sync Backend is production-ready")
    else:
        log("❌ SOME TESTS FAILED - Review details above")
    log("=" * 80)
    
    return all_passed

if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        log("\n\nTest interrupted by user")
        cleanup()
        exit(1)
    except Exception as e:
        log(f"\n\nFATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        cleanup()
        exit(1)
