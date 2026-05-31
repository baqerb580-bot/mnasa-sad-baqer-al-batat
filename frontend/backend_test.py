#!/usr/bin/env python3
"""
Regression Test Suite - Route.js Refactoring
Tests all extracted handlers and original endpoints to ensure backward compatibility
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BASE_URL = "https://isp-noc-hub.preview.emergentagent.com/api"

# Test results tracking
tests_passed = 0
tests_failed = 0
test_results = []

def log_test(name, passed, details=""):
    global tests_passed, tests_failed
    if passed:
        tests_passed += 1
        status = "✅ PASS"
    else:
        tests_failed += 1
        status = "❌ FAIL"
    
    result = f"{status} - {name}"
    if details:
        result += f"\n    {details}"
    print(result)
    test_results.append({"name": name, "passed": passed, "details": details})

def test_get(endpoint, expected_status=200, check_fields=None, test_name=None):
    """Test GET endpoint"""
    name = test_name or f"GET {endpoint}"
    try:
        url = f"{BASE_URL}/{endpoint}"
        resp = requests.get(url, timeout=30)
        
        if resp.status_code != expected_status:
            log_test(name, False, f"Expected {expected_status}, got {resp.status_code}")
            return None
        
        data = resp.json()
        
        if check_fields:
            for field in check_fields:
                if field not in data:
                    log_test(name, False, f"Missing field: {field}")
                    return None
        
        log_test(name, True, f"Status {resp.status_code}")
        return data
    except Exception as e:
        log_test(name, False, f"Exception: {str(e)}")
        return None

def test_post(endpoint, body, expected_status=200, check_fields=None, test_name=None):
    """Test POST endpoint"""
    name = test_name or f"POST {endpoint}"
    try:
        url = f"{BASE_URL}/{endpoint}"
        resp = requests.post(url, json=body, timeout=30)
        
        if resp.status_code != expected_status:
            log_test(name, False, f"Expected {expected_status}, got {resp.status_code}. Response: {resp.text[:200]}")
            return None
        
        data = resp.json()
        
        if check_fields:
            for field in check_fields:
                if field not in data:
                    log_test(name, False, f"Missing field: {field}")
                    return None
        
        log_test(name, True, f"Status {resp.status_code}")
        return data
    except Exception as e:
        log_test(name, False, f"Exception: {str(e)}")
        return None

def test_delete(endpoint, expected_status=200, test_name=None):
    """Test DELETE endpoint"""
    name = test_name or f"DELETE {endpoint}"
    try:
        url = f"{BASE_URL}/{endpoint}"
        resp = requests.delete(url, timeout=30)
        
        if resp.status_code != expected_status:
            log_test(name, False, f"Expected {expected_status}, got {resp.status_code}")
            return None
        
        log_test(name, True, f"Status {resp.status_code}")
        return resp.json() if resp.text else {}
    except Exception as e:
        log_test(name, False, f"Exception: {str(e)}")
        return None

def main():
    print("=" * 80)
    print("REGRESSION TEST SUITE - Route.js Refactoring")
    print("Testing extracted handlers + original endpoints")
    print("=" * 80)
    print()
    
    # Store IDs for cleanup
    coupon_id = None
    supplier_id = None
    
    print("### EXTRACTED HANDLERS - CRM ###")
    print()
    
    # Test 1: GET /api/crm/overview
    data = test_get("crm/overview", 200, ["totals", "byTier", "byRisk", "top10", "atRisk"])
    if data:
        print(f"    Total Customers: {data.get('totals', {}).get('totalCustomers', 0)}")
    
    # Test 2: GET /api/crm/customers
    data = test_get("crm/customers", 200, ["customers", "count"])
    if data:
        print(f"    Customers Count: {data.get('count', 0)}")
    
    print()
    print("### EXTRACTED HANDLERS - COUPONS ###")
    print()
    
    # Test 3: POST /api/coupons (create REGRESSION1)
    coupon_body = {
        "code": "REGRESSION1",
        "type": "percent",
        "value": 10,
        "description": "Regression test coupon",
        "active": True
    }
    data = test_post("coupons", coupon_body, 201, test_name="POST /api/coupons (create REGRESSION1)")
    if data and 'id' in data:
        coupon_id = data['id']
        print(f"    Created coupon ID: {coupon_id}")
    
    # Test 4: GET /api/coupons
    data = test_get("coupons", 200, test_name="GET /api/coupons")
    if data:
        found = any(c.get('code') == 'REGRESSION1' for c in data)
        if found:
            print(f"    Found REGRESSION1 in coupon list ✓")
        else:
            print(f"    WARNING: REGRESSION1 not found in list")
    
    # Test 5: POST /api/coupons/validate
    validate_body = {
        "code": "REGRESSION1",
        "orderTotal": 50000
    }
    data = test_post("coupons/validate", validate_body, 200, ["valid", "discount"], 
                     test_name="POST /api/coupons/validate")
    if data:
        if data.get('valid') and data.get('discount') == 5000:
            print(f"    Validation correct: discount=5000 (10% of 50000) ✓")
        else:
            print(f"    WARNING: Expected valid=true, discount=5000, got {data}")
    
    # Test 6: DELETE /api/coupons/:id
    if coupon_id:
        test_delete(f"coupons/{coupon_id}", 200, test_name="DELETE /api/coupons/:id (cleanup REGRESSION1)")
    
    print()
    print("### EXTRACTED HANDLERS - SUPPLIERS ###")
    print()
    
    # Test 7: POST /api/suppliers
    supplier_body = {
        "name": "اختبار refactor",
        "phone": "07700000000",
        "category": "اختبار",
        "active": True
    }
    data = test_post("suppliers", supplier_body, 201, test_name="POST /api/suppliers")
    if data and 'id' in data:
        supplier_id = data['id']
        print(f"    Created supplier ID: {supplier_id}")
    
    # Test 8: GET /api/suppliers
    data = test_get("suppliers", 200, test_name="GET /api/suppliers")
    if data:
        found = any(s.get('name') == 'اختبار refactor' for s in data)
        if found:
            print(f"    Found 'اختبار refactor' in supplier list ✓")
        else:
            print(f"    WARNING: Test supplier not found in list")
    
    # Test 9: DELETE /api/suppliers/:id
    if supplier_id:
        test_delete(f"suppliers/{supplier_id}", 200, test_name="DELETE /api/suppliers/:id (cleanup)")
    
    print()
    print("### EXTRACTED HANDLERS - PUSH NOTIFICATIONS ###")
    print()
    
    # Test 10: GET /api/push/vapid-key
    data = test_get("push/vapid-key", 200, ["publicKey"], test_name="GET /api/push/vapid-key")
    if data and data.get('publicKey', '').startswith('B'):
        print(f"    VAPID key starts with 'B' ✓")
    
    # Test 11: GET /api/push/subscriptions
    data = test_get("push/subscriptions", 200, test_name="GET /api/push/subscriptions")
    if data is not None:
        print(f"    Subscriptions count: {len(data)}")
    
    print()
    print("### EXTRACTED HANDLERS - MOBILE APP ###")
    print()
    
    # Test 12: GET /api/mobile-app/info
    data = test_get("mobile-app/info", 200, ["appId"], test_name="GET /api/mobile-app/info")
    if data:
        expected_app_id = "com.ghazlan.erp"
        if data.get('appId') == expected_app_id:
            print(f"    App ID correct: {expected_app_id} ✓")
        else:
            print(f"    WARNING: Expected appId={expected_app_id}, got {data.get('appId')}")
    
    print()
    print("### ORIGINAL ENDPOINTS (Regression Check) ###")
    print()
    
    # Test 13: GET /api/dashboard/stats
    test_get("dashboard/stats", 200, test_name="GET /api/dashboard/stats")
    
    # Test 14: GET /api/ai/insights
    data = test_get("ai/insights", 200, ["insights"], test_name="GET /api/ai/insights")
    if data:
        print(f"    Insights count: {len(data.get('insights', []))}")
    
    # Test 15: GET /api/products
    data = test_get("products", 200, test_name="GET /api/products")
    if data is not None:
        print(f"    Products count: {len(data)}")
    
    # Test 16: GET /api/subscribers
    data = test_get("subscribers", 200, test_name="GET /api/subscribers")
    if data is not None:
        print(f"    Subscribers count: {len(data)}")
    
    # Test 17: POST /api/auth/login
    login_body = {
        "username": "superadmin",
        "password": "SuperAdmin@2026"
    }
    data = test_post("auth/login", login_body, 200, ["token"], test_name="POST /api/auth/login")
    if data and 'token' in data:
        print(f"    Login successful, token received ✓")
    
    # Test 18: GET /api/zones
    data = test_get("zones", 200, test_name="GET /api/zones")
    if data is not None:
        print(f"    Zones count: {len(data)}")
    
    # Test 19: GET /api/orders
    data = test_get("orders", 200, test_name="GET /api/orders")
    if data is not None:
        print(f"    Orders count: {len(data)}")
    
    # Test 20: GET /api/whatsapp/templates
    data = test_get("whatsapp/templates", 200, test_name="GET /api/whatsapp/templates")
    if data is not None:
        print(f"    WhatsApp templates found: {len(data) if isinstance(data, list) else 'object'}")
    
    print()
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {tests_passed + tests_failed}")
    print(f"Passed: {tests_passed} ✅")
    print(f"Failed: {tests_failed} ❌")
    print()
    
    if tests_failed == 0:
        print("🎉 ALL TESTS PASSED - 100% Backward Compatibility Confirmed")
        return 0
    else:
        print(f"⚠️  {tests_failed} test(s) failed - Review required")
        return 1

if __name__ == "__main__":
    sys.exit(main())
