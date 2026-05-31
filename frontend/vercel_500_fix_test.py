#!/usr/bin/env python3
"""
Backend Production-Readiness Verification (Vercel 500 errors fix)
Tests ONLY the endpoints mentioned in the review request.
"""

import requests
import json
import sys
from datetime import datetime

# Base URL from environment
BASE_URL = "https://isp-noc-hub.preview.emergentagent.com/api"

def log(msg):
    """Print timestamped log message"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_vercel_500_fixes():
    """Test Vercel 500 error fixes and production readiness"""
    
    log("=" * 80)
    log("BACKEND PRODUCTION-READINESS VERIFICATION (Vercel 500 errors fix)")
    log("=" * 80)
    
    test_results = {
        "passed": 0,
        "failed": 0,
        "tests": []
    }
    
    def record_test(name, passed, details=""):
        test_results["tests"].append({"name": name, "passed": passed, "details": details})
        if passed:
            test_results["passed"] += 1
            log(f"✅ PASS: {name}")
        else:
            test_results["failed"] += 1
            log(f"❌ FAIL: {name}")
        if details:
            log(f"   Details: {details}")
    
    try:
        # ============================================================
        # TEST 1: GET /api/health (NEW endpoint)
        # ============================================================
        log("\n--- TEST 1: GET /api/health (NEW endpoint) ---")
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=10)
            log(f"Status: {response.status_code}")
            log(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
            
            if response.status_code == 200:
                # Check Content-Type
                content_type = response.headers.get('Content-Type', '')
                if 'application/json' not in content_type:
                    record_test("GET /api/health returns application/json", False, 
                               f"Got Content-Type: {content_type}")
                else:
                    record_test("GET /api/health returns application/json", True)
                
                # Check response shape
                data = response.json()
                log(f"Response: {json.dumps(data, indent=2)}")
                
                required_keys = ['status', 'dbConnected', 'dbError', 'ts']
                missing_keys = [k for k in required_keys if k not in data]
                
                if missing_keys:
                    record_test("GET /api/health returns correct shape", False,
                               f"Missing keys: {missing_keys}")
                else:
                    # Verify types
                    if (data['status'] == 'ok' and 
                        isinstance(data['dbConnected'], bool) and
                        (data['dbError'] is None or isinstance(data['dbError'], str)) and
                        isinstance(data['ts'], str)):
                        record_test("GET /api/health returns correct shape", True,
                                   f"status={data['status']}, dbConnected={data['dbConnected']}")
                    else:
                        record_test("GET /api/health returns correct shape", False,
                                   f"Wrong types: {data}")
            else:
                record_test("GET /api/health returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("GET /api/health", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 2: GET /api/dashboard/stats (hardened)
        # ============================================================
        log("\n--- TEST 2: GET /api/dashboard/stats (hardened) ---")
        try:
            response = requests.get(f"{BASE_URL}/dashboard/stats", timeout=10)
            log(f"Status: {response.status_code}")
            log(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
            
            if response.status_code == 200:
                # Check Content-Type
                content_type = response.headers.get('Content-Type', '')
                if 'application/json' not in content_type:
                    record_test("GET /api/dashboard/stats returns application/json", False,
                               f"Got Content-Type: {content_type}")
                else:
                    record_test("GET /api/dashboard/stats returns application/json", True)
                
                # Check response shape
                data = response.json()
                log(f"Response keys: {list(data.keys())}")
                
                required_keys = [
                    'totalProducts', 'totalSubscribers', 'activeSubscribers', 'totalRepairs',
                    'pendingRepairs', 'totalEmployees', 'totalZones', 'onlineZones',
                    'totalRevenue', 'monthlyIncome', 'totalDebt', 'lowStockCount',
                    'lowStock', 'salesChart'
                ]
                missing_keys = [k for k in required_keys if k not in data]
                
                if missing_keys:
                    record_test("GET /api/dashboard/stats has all required keys", False,
                               f"Missing keys: {missing_keys}")
                else:
                    record_test("GET /api/dashboard/stats has all required keys", True)
                
                # CRITICAL: Verify lowStock is ALWAYS an array (never undefined)
                if 'lowStock' not in data:
                    record_test("GET /api/dashboard/stats lowStock is present", False,
                               "lowStock key missing")
                elif not isinstance(data['lowStock'], list):
                    record_test("GET /api/dashboard/stats lowStock is array", False,
                               f"lowStock is {type(data['lowStock'])}, not array")
                else:
                    record_test("GET /api/dashboard/stats lowStock is array", True,
                               f"lowStock has {len(data['lowStock'])} items")
                
                # CRITICAL: Verify salesChart is array with 7 days
                if 'salesChart' not in data:
                    record_test("GET /api/dashboard/stats salesChart is present", False,
                               "salesChart key missing")
                elif not isinstance(data['salesChart'], list):
                    record_test("GET /api/dashboard/stats salesChart is array", False,
                               f"salesChart is {type(data['salesChart'])}, not array")
                elif len(data['salesChart']) != 7:
                    record_test("GET /api/dashboard/stats salesChart has 7 days", False,
                               f"salesChart has {len(data['salesChart'])} days, expected 7")
                else:
                    record_test("GET /api/dashboard/stats salesChart has 7 days", True)
                    # Verify each day has required fields
                    day_sample = data['salesChart'][0] if data['salesChart'] else {}
                    if 'name' in day_sample and 'sales' in day_sample and 'orders' in day_sample:
                        record_test("GET /api/dashboard/stats salesChart days have correct structure", True,
                                   f"Sample day: {day_sample}")
                    else:
                        record_test("GET /api/dashboard/stats salesChart days have correct structure", False,
                                   f"Missing fields in day: {day_sample}")
                
                # Verify all numeric fields are numbers
                numeric_fields = ['totalProducts', 'totalSubscribers', 'activeSubscribers', 
                                'totalRepairs', 'pendingRepairs', 'totalEmployees', 'totalZones',
                                'onlineZones', 'totalRevenue', 'monthlyIncome', 'totalDebt', 'lowStockCount']
                non_numeric = [f for f in numeric_fields if f in data and not isinstance(data[f], (int, float))]
                
                if non_numeric:
                    record_test("GET /api/dashboard/stats numeric fields are numbers", False,
                               f"Non-numeric fields: {non_numeric}")
                else:
                    record_test("GET /api/dashboard/stats numeric fields are numbers", True)
                
                log(f"Sample data: totalProducts={data.get('totalProducts')}, lowStock count={len(data.get('lowStock', []))}")
            else:
                record_test("GET /api/dashboard/stats returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("GET /api/dashboard/stats", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 3: GET /api/notifications/admin (hardened)
        # ============================================================
        log("\n--- TEST 3: GET /api/notifications/admin (hardened) ---")
        try:
            response = requests.get(f"{BASE_URL}/notifications/admin", timeout=10)
            log(f"Status: {response.status_code}")
            log(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
            
            if response.status_code == 200:
                # Check Content-Type
                content_type = response.headers.get('Content-Type', '')
                if 'application/json' not in content_type:
                    record_test("GET /api/notifications/admin returns application/json", False,
                               f"Got Content-Type: {content_type}")
                else:
                    record_test("GET /api/notifications/admin returns application/json", True)
                
                # CRITICAL: Response MUST be an array (never an object)
                data = response.json()
                log(f"Response type: {type(data)}")
                
                if not isinstance(data, list):
                    record_test("GET /api/notifications/admin returns array", False,
                               f"Response is {type(data)}, not array. Data: {data}")
                else:
                    record_test("GET /api/notifications/admin returns array", True,
                               f"Array with {len(data)} items")
                    
                    # If array has items, verify structure
                    if len(data) > 0:
                        sample = data[0]
                        expected_fields = ['id', 'type', 'title', 'message', 'read', 'createdAt']
                        missing = [f for f in expected_fields if f not in sample]
                        
                        if missing:
                            record_test("GET /api/notifications/admin items have correct structure", False,
                                       f"Missing fields: {missing}")
                        else:
                            record_test("GET /api/notifications/admin items have correct structure", True,
                                       f"Sample: {sample}")
                    else:
                        log("   Note: No notifications found (empty array is valid)")
            else:
                record_test("GET /api/notifications/admin returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("GET /api/notifications/admin", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 4: POST /api/notifications/admin/read-all
        # ============================================================
        log("\n--- TEST 4: POST /api/notifications/admin/read-all ---")
        try:
            response = requests.post(f"{BASE_URL}/notifications/admin/read-all", timeout=10)
            log(f"Status: {response.status_code}")
            log(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
            
            if response.status_code == 200:
                # Check Content-Type
                content_type = response.headers.get('Content-Type', '')
                if 'application/json' not in content_type:
                    record_test("POST /api/notifications/admin/read-all returns application/json", False,
                               f"Got Content-Type: {content_type}")
                else:
                    record_test("POST /api/notifications/admin/read-all returns application/json", True)
                
                # Check response shape
                data = response.json()
                log(f"Response: {json.dumps(data, indent=2)}")
                
                if 'success' in data and data['success'] == True:
                    record_test("POST /api/notifications/admin/read-all returns success", True)
                else:
                    record_test("POST /api/notifications/admin/read-all returns success", False,
                               f"Response: {data}")
            else:
                record_test("POST /api/notifications/admin/read-all returns 200", False, 
                           f"Got {response.status_code}")
        except Exception as e:
            record_test("POST /api/notifications/admin/read-all", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 5: GET /api/ai/insights (hardened)
        # ============================================================
        log("\n--- TEST 5: GET /api/ai/insights (hardened) ---")
        try:
            response = requests.get(f"{BASE_URL}/ai/insights", timeout=10)
            log(f"Status: {response.status_code}")
            log(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
            
            if response.status_code == 200:
                # Check Content-Type
                content_type = response.headers.get('Content-Type', '')
                if 'application/json' not in content_type:
                    record_test("GET /api/ai/insights returns application/json", False,
                               f"Got Content-Type: {content_type}")
                else:
                    record_test("GET /api/ai/insights returns application/json", True)
                
                # Check response shape
                data = response.json()
                log(f"Response keys: {list(data.keys())}")
                
                if 'insights' not in data:
                    record_test("GET /api/ai/insights has insights key", False,
                               f"Response: {data}")
                else:
                    # CRITICAL: insights MUST be an array (never undefined)
                    if not isinstance(data['insights'], list):
                        record_test("GET /api/ai/insights insights is array", False,
                                   f"insights is {type(data['insights'])}, not array")
                    else:
                        record_test("GET /api/ai/insights insights is array", True,
                                   f"insights has {len(data['insights'])} items")
                        
                        # Verify each insight has required fields
                        if len(data['insights']) > 0:
                            sample = data['insights'][0]
                            expected_fields = ['type', 'icon', 'title', 'message']
                            missing = [f for f in expected_fields if f not in sample]
                            
                            if missing:
                                record_test("GET /api/ai/insights items have correct structure", False,
                                           f"Missing fields: {missing}")
                            else:
                                record_test("GET /api/ai/insights items have correct structure", True,
                                           f"Sample: {sample}")
                        else:
                            log("   Note: No insights generated (empty array is valid)")
            else:
                record_test("GET /api/ai/insights returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("GET /api/ai/insights", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 6: Regression checks (quick verification)
        # ============================================================
        log("\n--- TEST 6: Regression checks ---")
        
        regression_endpoints = [
            ('GET /api/products', f"{BASE_URL}/products"),
            ('GET /api/subscribers', f"{BASE_URL}/subscribers"),
            ('GET /api/employees', f"{BASE_URL}/employees"),
            ('GET /api/tasks', f"{BASE_URL}/tasks"),
            ('GET /api/zones', f"{BASE_URL}/zones"),
        ]
        
        for name, url in regression_endpoints:
            try:
                response = requests.get(url, timeout=10)
                log(f"{name}: Status {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list):
                        record_test(f"{name} returns array", True, f"Array with {len(data)} items")
                    else:
                        record_test(f"{name} returns array", False, f"Got {type(data)}")
                else:
                    record_test(f"{name} returns 200", False, f"Got {response.status_code}")
            except Exception as e:
                record_test(name, False, f"Exception: {str(e)}")
        
    except Exception as e:
        log(f"❌ CRITICAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # ============================================================
    # SUMMARY
    # ============================================================
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    log(f"Total Tests: {test_results['passed'] + test_results['failed']}")
    log(f"✅ Passed: {test_results['passed']}")
    log(f"❌ Failed: {test_results['failed']}")
    log("=" * 80)
    
    if test_results['failed'] > 0:
        log("\nFailed Tests:")
        for test in test_results['tests']:
            if not test['passed']:
                log(f"  ❌ {test['name']}")
                if test['details']:
                    log(f"     {test['details']}")
    else:
        log("\n🎉 ALL TESTS PASSED - Backend is production-ready!")
    
    return test_results['failed'] == 0

if __name__ == "__main__":
    success = test_vercel_500_fixes()
    sys.exit(0 if success else 1)
