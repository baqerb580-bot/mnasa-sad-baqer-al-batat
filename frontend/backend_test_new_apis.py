#!/usr/bin/env python3
"""
Backend Testing Script for NEW APIs (Batch 3 & 4)
Tests CRM, Coupons, Mobile App, Suppliers, Purchase Orders, Push Notifications, WhatsApp Templates
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "https://isp-noc-hub.preview.emergentagent.com/api"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_result(test_name, passed, details=""):
    status = "✅ PASSED" if passed else "❌ FAILED"
    log(f"{test_name} - {status}")
    if details:
        log(f"  Details: {details}")
    return passed

# ============================================================================
# TEST GROUP 1: CRM APIs
# ============================================================================

def test_crm_overview():
    """Test: GET /api/crm/overview"""
    log("\n=== TEST: GET /api/crm/overview ===")
    try:
        resp = requests.get(f"{BASE_URL}/crm/overview", timeout=10)
        if resp.status_code != 200:
            return test_result("CRM Overview", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        # Verify required fields
        required_fields = ['totals', 'byTier', 'byRisk', 'top10', 'atRisk']
        missing = [f for f in required_fields if f not in data]
        if missing:
            return test_result("CRM Overview", False, f"Missing fields: {missing}")
        
        # Verify totals structure
        totals = data['totals']
        if 'totalCustomers' not in totals:
            return test_result("CRM Overview", False, "Missing totals.totalCustomers")
        
        if totals['totalCustomers'] <= 0:
            return test_result("CRM Overview", False, f"totalCustomers should be > 0, got {totals['totalCustomers']}")
        
        return test_result("CRM Overview", True, f"Returns all required fields. totalCustomers={totals['totalCustomers']}")
    except Exception as e:
        return test_result("CRM Overview", False, str(e))

def test_crm_customers():
    """Test: GET /api/crm/customers"""
    log("\n=== TEST: GET /api/crm/customers ===")
    try:
        resp = requests.get(f"{BASE_URL}/crm/customers", timeout=10)
        if resp.status_code != 200:
            return test_result("CRM Customers List", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        # Verify response structure
        if 'customers' not in data or 'count' not in data:
            return test_result("CRM Customers List", False, "Missing customers or count field")
        
        if not isinstance(data['customers'], list):
            return test_result("CRM Customers List", False, "customers is not an array")
        
        # Verify customer has computed fields
        if data['customers']:
            customer = data['customers'][0]
            required_fields = ['subscriberId', 'name', 'lifetimeValue', 'loyaltyPoints', 'tier']
            missing = [f for f in required_fields if f not in customer]
            if missing:
                return test_result("CRM Customers List", False, f"Missing customer fields: {missing}")
        
        # Save first customer ID for next test
        global first_customer_id
        if data['customers']:
            first_customer_id = data['customers'][0]['subscriberId']
        
        return test_result("CRM Customers List", True, f"Returns {data['count']} customers with computed loyalty points & tier")
    except Exception as e:
        return test_result("CRM Customers List", False, str(e))

def test_crm_customer_detail():
    """Test: GET /api/crm/customers/:id"""
    log("\n=== TEST: GET /api/crm/customers/:id ===")
    try:
        if not first_customer_id:
            return test_result("CRM Customer Detail", False, "No customer ID available from previous test")
        
        resp = requests.get(f"{BASE_URL}/crm/customers/{first_customer_id}", timeout=10)
        if resp.status_code != 200:
            return test_result("CRM Customer Detail", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        # Verify detailed view structure
        required_fields = ['customer', 'sales', 'activations']
        missing = [f for f in required_fields if f not in data]
        if missing:
            return test_result("CRM Customer Detail", False, f"Missing fields: {missing}")
        
        return test_result("CRM Customer Detail", True, f"Returns detailed view with sales ({len(data['sales'])}) and activations ({len(data['activations'])})")
    except Exception as e:
        return test_result("CRM Customer Detail", False, str(e))

def test_crm_add_note():
    """Test: POST /api/crm/customers/:id/note"""
    log("\n=== TEST: POST /api/crm/customers/:id/note ===")
    try:
        if not first_customer_id:
            return test_result("CRM Add Note", False, "No customer ID available")
        
        payload = {"text": "عميل VIP - تجريبي"}
        resp = requests.post(f"{BASE_URL}/crm/customers/{first_customer_id}/note", json=payload, timeout=10)
        
        if resp.status_code != 200:
            return test_result("CRM Add Note", False, f"Status {resp.status_code}: {resp.text}")
        
        data = resp.json()
        
        if not data.get('success'):
            return test_result("CRM Add Note", False, "success field is not true")
        
        if 'note' not in data:
            return test_result("CRM Add Note", False, "note field missing")
        
        # Save note ID for delete test
        global note_id
        note_id = data['note'].get('id')
        
        return test_result("CRM Add Note", True, f"Note added successfully with ID: {note_id}")
    except Exception as e:
        return test_result("CRM Add Note", False, str(e))

def test_crm_delete_note():
    """Test: DELETE /api/crm/customers/:id/note/:noteId"""
    log("\n=== TEST: DELETE /api/crm/customers/:id/note/:noteId ===")
    try:
        if not first_customer_id or not note_id:
            return test_result("CRM Delete Note", False, "No customer ID or note ID available")
        
        resp = requests.delete(f"{BASE_URL}/crm/customers/{first_customer_id}/note/{note_id}", timeout=10)
        
        if resp.status_code != 200:
            return test_result("CRM Delete Note", False, f"Status {resp.status_code}: {resp.text}")
        
        data = resp.json()
        
        if not data.get('success'):
            return test_result("CRM Delete Note", False, "success field is not true")
        
        return test_result("CRM Delete Note", True, "Note deleted successfully")
    except Exception as e:
        return test_result("CRM Delete Note", False, str(e))

# ============================================================================
# TEST GROUP 2: Coupons APIs
# ============================================================================

def test_coupons_create():
    """Test: POST /api/coupons"""
    log("\n=== TEST: POST /api/coupons ===")
    try:
        payload = {
            "code": "TEST20",
            "type": "percent",
            "value": 20,
            "minOrder": 10000,
            "description": "اختبار"
        }
        
        resp = requests.post(f"{BASE_URL}/coupons", json=payload, timeout=10)
        
        if resp.status_code != 201:
            return test_result("Coupons Create", False, f"Status {resp.status_code}: {resp.text}")
        
        data = resp.json()
        
        # Verify coupon structure
        if 'id' not in data or 'code' not in data:
            return test_result("Coupons Create", False, "Missing id or code field")
        
        # Save coupon ID for later tests
        global coupon_id
        coupon_id = data['id']
        
        return test_result("Coupons Create", True, f"Coupon TEST20 created with ID: {coupon_id}")
    except Exception as e:
        return test_result("Coupons Create", False, str(e))

def test_coupons_list():
    """Test: GET /api/coupons"""
    log("\n=== TEST: GET /api/coupons ===")
    try:
        resp = requests.get(f"{BASE_URL}/coupons", timeout=10)
        
        if resp.status_code != 200:
            return test_result("Coupons List", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        if not isinstance(data, list):
            return test_result("Coupons List", False, "Response is not an array")
        
        # Verify TEST20 is in the list
        test20 = next((c for c in data if c.get('code') == 'TEST20'), None)
        if not test20:
            return test_result("Coupons List", False, "TEST20 coupon not found in list")
        
        return test_result("Coupons List", True, f"Returns array with {len(data)} coupons including TEST20")
    except Exception as e:
        return test_result("Coupons List", False, str(e))

def test_coupons_validate_valid():
    """Test: POST /api/coupons/validate - valid case"""
    log("\n=== TEST: POST /api/coupons/validate (valid) ===")
    try:
        payload = {
            "code": "TEST20",
            "orderTotal": 50000
        }
        
        resp = requests.post(f"{BASE_URL}/coupons/validate", json=payload, timeout=10)
        
        if resp.status_code != 200:
            return test_result("Coupons Validate (valid)", False, f"Status {resp.status_code}: {resp.text}")
        
        data = resp.json()
        
        if not data.get('valid'):
            return test_result("Coupons Validate (valid)", False, f"Expected valid=true, got {data}")
        
        # Verify discount calculation (20% of 50000 = 10000)
        expected_discount = 10000
        expected_final = 40000
        
        if data.get('discount') != expected_discount:
            return test_result("Coupons Validate (valid)", False, f"Expected discount={expected_discount}, got {data.get('discount')}")
        
        if data.get('finalTotal') != expected_final:
            return test_result("Coupons Validate (valid)", False, f"Expected finalTotal={expected_final}, got {data.get('finalTotal')}")
        
        return test_result("Coupons Validate (valid)", True, f"Valid: discount={expected_discount}, finalTotal={expected_final}")
    except Exception as e:
        return test_result("Coupons Validate (valid)", False, str(e))

def test_coupons_validate_below_min():
    """Test: POST /api/coupons/validate - below minOrder"""
    log("\n=== TEST: POST /api/coupons/validate (below minOrder) ===")
    try:
        payload = {
            "code": "TEST20",
            "orderTotal": 5000
        }
        
        resp = requests.post(f"{BASE_URL}/coupons/validate", json=payload, timeout=10)
        
        if resp.status_code != 200:
            return test_result("Coupons Validate (below min)", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        if data.get('valid') != False:
            return test_result("Coupons Validate (below min)", False, f"Expected valid=false, got {data}")
        
        return test_result("Coupons Validate (below min)", True, "Correctly rejected order below minOrder")
    except Exception as e:
        return test_result("Coupons Validate (below min)", False, str(e))

def test_coupons_update():
    """Test: PUT /api/coupons/:id"""
    log("\n=== TEST: PUT /api/coupons/:id ===")
    try:
        if not coupon_id:
            return test_result("Coupons Update", False, "No coupon ID available")
        
        payload = {"active": False}
        
        resp = requests.put(f"{BASE_URL}/coupons/{coupon_id}", json=payload, timeout=10)
        
        if resp.status_code != 200:
            return test_result("Coupons Update", False, f"Status {resp.status_code}: {resp.text}")
        
        data = resp.json()
        
        if not data.get('success'):
            return test_result("Coupons Update", False, "success field is not true")
        
        return test_result("Coupons Update", True, "Coupon updated to active=false")
    except Exception as e:
        return test_result("Coupons Update", False, str(e))

def test_coupons_validate_inactive():
    """Test: POST /api/coupons/validate - inactive coupon"""
    log("\n=== TEST: POST /api/coupons/validate (inactive) ===")
    try:
        payload = {
            "code": "TEST20",
            "orderTotal": 50000
        }
        
        resp = requests.post(f"{BASE_URL}/coupons/validate", json=payload, timeout=10)
        
        if resp.status_code != 200:
            return test_result("Coupons Validate (inactive)", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        if data.get('valid') != False:
            return test_result("Coupons Validate (inactive)", False, f"Expected valid=false, got {data}")
        
        if 'error' not in data:
            return test_result("Coupons Validate (inactive)", False, "error field missing")
        
        if "غير مفعّل" not in data['error']:
            return test_result("Coupons Validate (inactive)", False, f"Expected 'غير مفعّل' in error, got: {data['error']}")
        
        return test_result("Coupons Validate (inactive)", True, f"Correctly rejected with error: {data['error']}")
    except Exception as e:
        return test_result("Coupons Validate (inactive)", False, str(e))

def test_coupons_delete():
    """Test: DELETE /api/coupons/:id"""
    log("\n=== TEST: DELETE /api/coupons/:id ===")
    try:
        if not coupon_id:
            return test_result("Coupons Delete", False, "No coupon ID available")
        
        resp = requests.delete(f"{BASE_URL}/coupons/{coupon_id}", timeout=10)
        
        if resp.status_code != 200:
            return test_result("Coupons Delete", False, f"Status {resp.status_code}: {resp.text}")
        
        data = resp.json()
        
        if not data.get('success'):
            return test_result("Coupons Delete", False, "success field is not true")
        
        return test_result("Coupons Delete", True, "Coupon deleted successfully")
    except Exception as e:
        return test_result("Coupons Delete", False, str(e))

# ============================================================================
# TEST GROUP 3: Mobile App APIs
# ============================================================================

def test_mobile_app_info():
    """Test: GET /api/mobile-app/info"""
    log("\n=== TEST: GET /api/mobile-app/info ===")
    try:
        resp = requests.get(f"{BASE_URL}/mobile-app/info", timeout=10)
        
        if resp.status_code != 200:
            return test_result("Mobile App Info", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        # Verify required fields
        required_fields = ['appId', 'appName', 'serverUrl', 'projectExists']
        missing = [f for f in required_fields if f not in data]
        if missing:
            return test_result("Mobile App Info", False, f"Missing fields: {missing}")
        
        if data['appId'] != 'com.ghazlan.erp':
            return test_result("Mobile App Info", False, f"Expected appId=com.ghazlan.erp, got {data['appId']}")
        
        if data['appName'] != 'مركز الغزلان':
            return test_result("Mobile App Info", False, f"Expected appName=مركز الغزلان, got {data['appName']}")
        
        if data['projectExists'] != True:
            return test_result("Mobile App Info", False, f"Expected projectExists=true, got {data['projectExists']}")
        
        return test_result("Mobile App Info", True, f"Returns correct info: {data['appId']}, {data['appName']}")
    except Exception as e:
        return test_result("Mobile App Info", False, str(e))

def test_mobile_app_download():
    """Test: GET /api/mobile-app/download-project"""
    log("\n=== TEST: GET /api/mobile-app/download-project ===")
    try:
        resp = requests.get(f"{BASE_URL}/mobile-app/download-project", timeout=30, stream=True)
        
        if resp.status_code != 200:
            return test_result("Mobile App Download", False, f"Status {resp.status_code}")
        
        # Verify Content-Type
        content_type = resp.headers.get('Content-Type', '')
        if 'application/zip' not in content_type:
            return test_result("Mobile App Download", False, f"Expected Content-Type=application/zip, got {content_type}")
        
        # Verify Content-Length > 1MB
        content_length = int(resp.headers.get('Content-Length', 0))
        if content_length < 1000000:
            return test_result("Mobile App Download", False, f"Expected Content-Length > 1MB, got {content_length}")
        
        # Verify Content-Disposition header
        content_disposition = resp.headers.get('Content-Disposition', '')
        if 'attachment' not in content_disposition or 'ghazlan-android' not in content_disposition:
            return test_result("Mobile App Download", False, f"Invalid Content-Disposition: {content_disposition}")
        
        return test_result("Mobile App Download", True, f"Returns ZIP file ({content_length} bytes) with correct headers")
    except Exception as e:
        return test_result("Mobile App Download", False, str(e))

# ============================================================================
# TEST GROUP 4: Suppliers & Purchase Orders APIs
# ============================================================================

def test_suppliers_create():
    """Test: POST /api/suppliers"""
    log("\n=== TEST: POST /api/suppliers ===")
    try:
        payload = {
            "name": "مورد اختبار",
            "phone": "07712345678",
            "category": "اختبار"
        }
        
        resp = requests.post(f"{BASE_URL}/suppliers", json=payload, timeout=10)
        
        if resp.status_code != 201:
            return test_result("Suppliers Create", False, f"Status {resp.status_code}: {resp.text}")
        
        data = resp.json()
        
        if 'id' not in data:
            return test_result("Suppliers Create", False, "Missing id field")
        
        # Save supplier ID for later tests
        global supplier_id
        supplier_id = data['id']
        
        return test_result("Suppliers Create", True, f"Supplier created with ID: {supplier_id}")
    except Exception as e:
        return test_result("Suppliers Create", False, str(e))

def test_suppliers_list():
    """Test: GET /api/suppliers"""
    log("\n=== TEST: GET /api/suppliers ===")
    try:
        resp = requests.get(f"{BASE_URL}/suppliers", timeout=10)
        
        if resp.status_code != 200:
            return test_result("Suppliers List", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        if not isinstance(data, list):
            return test_result("Suppliers List", False, "Response is not an array")
        
        # Verify our test supplier is in the list
        test_supplier = next((s for s in data if s.get('id') == supplier_id), None)
        if not test_supplier:
            return test_result("Suppliers List", False, "Test supplier not found in list")
        
        return test_result("Suppliers List", True, f"Returns array with {len(data)} suppliers including test supplier")
    except Exception as e:
        return test_result("Suppliers List", False, str(e))

def test_suppliers_update():
    """Test: PUT /api/suppliers/:id"""
    log("\n=== TEST: PUT /api/suppliers/:id ===")
    try:
        if not supplier_id:
            return test_result("Suppliers Update", False, "No supplier ID available")
        
        payload = {"notes": "محدث"}
        
        resp = requests.put(f"{BASE_URL}/suppliers/{supplier_id}", json=payload, timeout=10)
        
        if resp.status_code != 200:
            return test_result("Suppliers Update", False, f"Status {resp.status_code}: {resp.text}")
        
        data = resp.json()
        
        if not data.get('success'):
            return test_result("Suppliers Update", False, "success field is not true")
        
        return test_result("Suppliers Update", True, "Supplier updated successfully")
    except Exception as e:
        return test_result("Suppliers Update", False, str(e))

def test_purchase_orders_create():
    """Test: POST /api/purchase-orders"""
    log("\n=== TEST: POST /api/purchase-orders ===")
    try:
        if not supplier_id:
            return test_result("Purchase Orders Create", False, "No supplier ID available")
        
        payload = {
            "supplierId": supplier_id,
            "items": [
                {
                    "name": "منتج اختبار",
                    "quantity": 5,
                    "cost": 1000
                }
            ],
            "paid": 3000,
            "updateStock": False
        }
        
        resp = requests.post(f"{BASE_URL}/purchase-orders", json=payload, timeout=10)
        
        if resp.status_code != 201:
            return test_result("Purchase Orders Create", False, f"Status {resp.status_code}: {resp.text}")
        
        data = resp.json()
        
        # Verify PO structure
        if data.get('total') != 5000:
            return test_result("Purchase Orders Create", False, f"Expected total=5000, got {data.get('total')}")
        
        if data.get('paid') != 3000:
            return test_result("Purchase Orders Create", False, f"Expected paid=3000, got {data.get('paid')}")
        
        if data.get('remaining') != 2000:
            return test_result("Purchase Orders Create", False, f"Expected remaining=2000, got {data.get('remaining')}")
        
        if data.get('status') != 'partial':
            return test_result("Purchase Orders Create", False, f"Expected status=partial, got {data.get('status')}")
        
        # Save PO ID and number for later tests
        global po_id, po_number
        po_id = data.get('id')
        po_number = data.get('poNumber')
        
        return test_result("Purchase Orders Create", True, f"PO created: total=5000, paid=3000, remaining=2000, status=partial, poNumber={po_number}")
    except Exception as e:
        return test_result("Purchase Orders Create", False, str(e))

def test_purchase_orders_list():
    """Test: GET /api/purchase-orders"""
    log("\n=== TEST: GET /api/purchase-orders ===")
    try:
        resp = requests.get(f"{BASE_URL}/purchase-orders", timeout=10)
        
        if resp.status_code != 200:
            return test_result("Purchase Orders List", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        if not isinstance(data, list):
            return test_result("Purchase Orders List", False, "Response is not an array")
        
        # Verify our test PO is in the list
        test_po = next((p for p in data if p.get('id') == po_id), None)
        if not test_po:
            return test_result("Purchase Orders List", False, "Test PO not found in list")
        
        return test_result("Purchase Orders List", True, f"Returns array with {len(data)} POs including test PO")
    except Exception as e:
        return test_result("Purchase Orders List", False, str(e))

def test_suppliers_pay():
    """Test: POST /api/suppliers/:id/pay"""
    log("\n=== TEST: POST /api/suppliers/:id/pay ===")
    try:
        if not supplier_id:
            return test_result("Suppliers Pay", False, "No supplier ID available")
        
        payload = {
            "amount": 1000,
            "paymentMethod": "cash"
        }
        
        resp = requests.post(f"{BASE_URL}/suppliers/{supplier_id}/pay", json=payload, timeout=10)
        
        if resp.status_code != 200:
            return test_result("Suppliers Pay", False, f"Status {resp.status_code}: {resp.text}")
        
        data = resp.json()
        
        if not data.get('success'):
            return test_result("Suppliers Pay", False, "success field is not true")
        
        if 'newBalance' not in data:
            return test_result("Suppliers Pay", False, "newBalance field missing")
        
        return test_result("Suppliers Pay", True, f"Payment successful, newBalance={data['newBalance']}")
    except Exception as e:
        return test_result("Suppliers Pay", False, str(e))

def test_suppliers_statement():
    """Test: GET /api/suppliers/:id/statement"""
    log("\n=== TEST: GET /api/suppliers/:id/statement ===")
    try:
        if not supplier_id:
            return test_result("Suppliers Statement", False, "No supplier ID available")
        
        resp = requests.get(f"{BASE_URL}/suppliers/{supplier_id}/statement", timeout=10)
        
        if resp.status_code != 200:
            return test_result("Suppliers Statement", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        # Verify statement structure
        required_fields = ['supplier', 'pos', 'payments', 'totalPurchased', 'totalPaid', 'currentBalance']
        missing = [f for f in required_fields if f not in data]
        if missing:
            return test_result("Suppliers Statement", False, f"Missing fields: {missing}")
        
        return test_result("Suppliers Statement", True, f"Returns complete statement: totalPurchased={data['totalPurchased']}, totalPaid={data['totalPaid']}, currentBalance={data['currentBalance']}")
    except Exception as e:
        return test_result("Suppliers Statement", False, str(e))

def test_suppliers_delete_with_po():
    """Test: DELETE /api/suppliers/:id - should fail with linked PO"""
    log("\n=== TEST: DELETE /api/suppliers/:id (with linked PO) ===")
    try:
        if not supplier_id:
            return test_result("Suppliers Delete (with PO)", False, "No supplier ID available")
        
        resp = requests.delete(f"{BASE_URL}/suppliers/{supplier_id}", timeout=10)
        
        # Should return error because PO is linked
        if resp.status_code == 200:
            return test_result("Suppliers Delete (with PO)", False, "Expected error, but deletion succeeded")
        
        error_text = resp.text
        if "فاتورة شراء" not in error_text:
            return test_result("Suppliers Delete (with PO)", False, f"Expected Arabic error about linked PO, got: {error_text}")
        
        return test_result("Suppliers Delete (with PO)", True, f"Correctly rejected deletion with error: {error_text[:100]}")
    except Exception as e:
        return test_result("Suppliers Delete (with PO)", False, str(e))

# ============================================================================
# TEST GROUP 5: Push Notifications APIs
# ============================================================================

def test_push_vapid_key():
    """Test: GET /api/push/vapid-key"""
    log("\n=== TEST: GET /api/push/vapid-key ===")
    try:
        resp = requests.get(f"{BASE_URL}/push/vapid-key", timeout=10)
        
        if resp.status_code != 200:
            return test_result("Push VAPID Key", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        if 'publicKey' not in data:
            return test_result("Push VAPID Key", False, "publicKey field missing")
        
        public_key = data['publicKey']
        if not public_key.startswith('B'):
            return test_result("Push VAPID Key", False, f"Expected public key to start with 'B', got: {public_key[:10]}")
        
        return test_result("Push VAPID Key", True, f"Returns public key: {public_key[:20]}...")
    except Exception as e:
        return test_result("Push VAPID Key", False, str(e))

def test_push_subscriptions_empty():
    """Test: GET /api/push/subscriptions (initial)"""
    log("\n=== TEST: GET /api/push/subscriptions (initial) ===")
    try:
        resp = requests.get(f"{BASE_URL}/push/subscriptions", timeout=10)
        
        if resp.status_code != 200:
            return test_result("Push Subscriptions (initial)", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        if not isinstance(data, list):
            return test_result("Push Subscriptions (initial)", False, "Response is not an array")
        
        return test_result("Push Subscriptions (initial)", True, f"Returns array with {len(data)} subscriptions")
    except Exception as e:
        return test_result("Push Subscriptions (initial)", False, str(e))

def test_push_subscribe():
    """Test: POST /api/push/subscribe"""
    log("\n=== TEST: POST /api/push/subscribe ===")
    try:
        payload = {
            "subscription": {
                "endpoint": "https://fake-test-endpoint.example/abc",
                "keys": {
                    "p256dh": "fake",
                    "auth": "fake"
                }
            },
            "label": "اختبار"
        }
        
        resp = requests.post(f"{BASE_URL}/push/subscribe", json=payload, timeout=10)
        
        if resp.status_code != 200:
            return test_result("Push Subscribe", False, f"Status {resp.status_code}: {resp.text}")
        
        data = resp.json()
        
        if not data.get('success'):
            return test_result("Push Subscribe", False, "success field is not true")
        
        return test_result("Push Subscribe", True, "Subscription added successfully")
    except Exception as e:
        return test_result("Push Subscribe", False, str(e))

def test_push_subscriptions_after_subscribe():
    """Test: GET /api/push/subscriptions (after subscribe)"""
    log("\n=== TEST: GET /api/push/subscriptions (after subscribe) ===")
    try:
        resp = requests.get(f"{BASE_URL}/push/subscriptions", timeout=10)
        
        if resp.status_code != 200:
            return test_result("Push Subscriptions (after)", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        if not isinstance(data, list):
            return test_result("Push Subscriptions (after)", False, "Response is not an array")
        
        # Verify our test subscription is in the list
        test_sub = next((s for s in data if s.get('label') == 'اختبار'), None)
        if not test_sub:
            return test_result("Push Subscriptions (after)", False, "Test subscription with label 'اختبار' not found")
        
        return test_result("Push Subscriptions (after)", True, f"Returns array with {len(data)} subscriptions including test subscription")
    except Exception as e:
        return test_result("Push Subscriptions (after)", False, str(e))

def test_push_send():
    """Test: POST /api/push/send"""
    log("\n=== TEST: POST /api/push/send ===")
    try:
        payload = {
            "title": "اختبار",
            "message": "رسالة اختبار"
        }
        
        resp = requests.post(f"{BASE_URL}/push/send", json=payload, timeout=10)
        
        if resp.status_code != 200:
            return test_result("Push Send", False, f"Status {resp.status_code}: {resp.text}")
        
        data = resp.json()
        
        # Note: May have failed:1 because fake endpoint, but should not 500
        if 'sent' not in data or 'failed' not in data:
            return test_result("Push Send", False, "Missing sent or failed field")
        
        return test_result("Push Send", True, f"Broadcast sent: sent={data.get('sent')}, failed={data.get('failed')} (fake endpoint expected to fail)")
    except Exception as e:
        return test_result("Push Send", False, str(e))

def test_push_unsubscribe():
    """Test: POST /api/push/unsubscribe"""
    log("\n=== TEST: POST /api/push/unsubscribe ===")
    try:
        payload = {
            "endpoint": "https://fake-test-endpoint.example/abc"
        }
        
        resp = requests.post(f"{BASE_URL}/push/unsubscribe", json=payload, timeout=10)
        
        if resp.status_code != 200:
            return test_result("Push Unsubscribe", False, f"Status {resp.status_code}: {resp.text}")
        
        data = resp.json()
        
        if not data.get('success'):
            return test_result("Push Unsubscribe", False, "success field is not true")
        
        return test_result("Push Unsubscribe", True, "Unsubscribed successfully")
    except Exception as e:
        return test_result("Push Unsubscribe", False, str(e))

# ============================================================================
# TEST GROUP 6: WhatsApp Templates APIs
# ============================================================================

def test_whatsapp_templates_get():
    """Test: GET /api/whatsapp/templates"""
    log("\n=== TEST: GET /api/whatsapp/templates ===")
    try:
        resp = requests.get(f"{BASE_URL}/whatsapp/templates", timeout=10)
        
        if resp.status_code != 200:
            return test_result("WhatsApp Templates Get", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        # Verify templates structure
        if 'templates' not in data:
            return test_result("WhatsApp Templates Get", False, "templates field missing")
        
        templates = data['templates']
        
        # Verify at least 6 default keys exist
        default_keys = ['activation', 'expiry', 'expiry_alert', 'debt', 'receipt', 'generic']
        missing = [k for k in default_keys if k not in templates]
        if missing:
            return test_result("WhatsApp Templates Get", False, f"Missing default template keys: {missing}")
        
        return test_result("WhatsApp Templates Get", True, f"Returns templates dict with {len(templates)} keys including all defaults")
    except Exception as e:
        return test_result("WhatsApp Templates Get", False, str(e))

def test_whatsapp_templates_update():
    """Test: PUT /api/whatsapp/templates"""
    log("\n=== TEST: PUT /api/whatsapp/templates ===")
    try:
        # First get existing templates
        resp = requests.get(f"{BASE_URL}/whatsapp/templates", timeout=10)
        if resp.status_code != 200:
            return test_result("WhatsApp Templates Update", False, "Cannot fetch existing templates")
        
        existing = resp.json()
        templates = existing.get('templates', {})
        
        # Add custom template
        templates['eid_fitr'] = "🌙 عيد فطر مبارك {name}"
        
        payload = {"templates": templates}
        
        resp = requests.put(f"{BASE_URL}/whatsapp/templates", json=payload, timeout=10)
        
        if resp.status_code != 200:
            return test_result("WhatsApp Templates Update", False, f"Status {resp.status_code}: {resp.text}")
        
        data = resp.json()
        
        if not data.get('success'):
            return test_result("WhatsApp Templates Update", False, "success field is not true")
        
        return test_result("WhatsApp Templates Update", True, "Templates updated with custom eid_fitr key")
    except Exception as e:
        return test_result("WhatsApp Templates Update", False, str(e))

def test_whatsapp_templates_verify_custom():
    """Test: GET /api/whatsapp/templates - verify custom key"""
    log("\n=== TEST: GET /api/whatsapp/templates (verify custom) ===")
    try:
        resp = requests.get(f"{BASE_URL}/whatsapp/templates", timeout=10)
        
        if resp.status_code != 200:
            return test_result("WhatsApp Templates Verify", False, f"Status {resp.status_code}")
        
        data = resp.json()
        templates = data.get('templates', {})
        
        if 'eid_fitr' not in templates:
            return test_result("WhatsApp Templates Verify", False, "Custom eid_fitr key not found")
        
        if "عيد فطر مبارك" not in templates['eid_fitr']:
            return test_result("WhatsApp Templates Verify", False, f"Unexpected eid_fitr value: {templates['eid_fitr']}")
        
        return test_result("WhatsApp Templates Verify", True, f"Custom template verified: {templates['eid_fitr']}")
    except Exception as e:
        return test_result("WhatsApp Templates Verify", False, str(e))

# ============================================================================
# TEST GROUP 7: Regression Checks
# ============================================================================

def test_regression_dashboard_stats():
    """Test: GET /api/dashboard/stats"""
    log("\n=== TEST: GET /api/dashboard/stats (regression) ===")
    try:
        resp = requests.get(f"{BASE_URL}/dashboard/stats", timeout=10)
        
        if resp.status_code != 200:
            return test_result("Regression: Dashboard Stats", False, f"Status {resp.status_code}")
        
        return test_result("Regression: Dashboard Stats", True, "Endpoint still working")
    except Exception as e:
        return test_result("Regression: Dashboard Stats", False, str(e))

def test_regression_ai_insights():
    """Test: GET /api/ai/insights"""
    log("\n=== TEST: GET /api/ai/insights (regression) ===")
    try:
        resp = requests.get(f"{BASE_URL}/ai/insights", timeout=10)
        
        if resp.status_code != 200:
            return test_result("Regression: AI Insights", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        if 'insights' not in data:
            return test_result("Regression: AI Insights", False, "insights field missing")
        
        # Empty insights is OK as long as status is 200
        return test_result("Regression: AI Insights", True, f"Endpoint working, returns {len(data['insights'])} insights")
    except Exception as e:
        return test_result("Regression: AI Insights", False, str(e))

def test_regression_products():
    """Test: GET /api/products"""
    log("\n=== TEST: GET /api/products (regression) ===")
    try:
        resp = requests.get(f"{BASE_URL}/products", timeout=10)
        
        if resp.status_code != 200:
            return test_result("Regression: Products", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        if not isinstance(data, list):
            return test_result("Regression: Products", False, "Response is not an array")
        
        return test_result("Regression: Products", True, f"Endpoint working, returns {len(data)} products")
    except Exception as e:
        return test_result("Regression: Products", False, str(e))

def test_regression_subscribers():
    """Test: GET /api/subscribers"""
    log("\n=== TEST: GET /api/subscribers (regression) ===")
    try:
        resp = requests.get(f"{BASE_URL}/subscribers", timeout=10)
        
        if resp.status_code != 200:
            return test_result("Regression: Subscribers", False, f"Status {resp.status_code}")
        
        data = resp.json()
        
        if not isinstance(data, list):
            return test_result("Regression: Subscribers", False, "Response is not an array")
        
        return test_result("Regression: Subscribers", True, f"Endpoint working, returns {len(data)} subscribers")
    except Exception as e:
        return test_result("Regression: Subscribers", False, str(e))

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

# Global variables for test data
first_customer_id = None
note_id = None
coupon_id = None
supplier_id = None
po_id = None
po_number = None

def main():
    log("=" * 80)
    log("BACKEND TESTING: NEW APIs (CRM, Coupons, Mobile App, Suppliers, Push, WhatsApp)")
    log("=" * 80)
    
    results = []
    
    # TEST GROUP 1: CRM APIs (5 tests)
    log("\n" + "=" * 80)
    log("TEST GROUP 1: CRM APIs")
    log("=" * 80)
    results.append(test_crm_overview())
    results.append(test_crm_customers())
    results.append(test_crm_customer_detail())
    results.append(test_crm_add_note())
    results.append(test_crm_delete_note())
    
    # TEST GROUP 2: Coupons APIs (8 tests)
    log("\n" + "=" * 80)
    log("TEST GROUP 2: Coupons APIs")
    log("=" * 80)
    results.append(test_coupons_create())
    results.append(test_coupons_list())
    results.append(test_coupons_validate_valid())
    results.append(test_coupons_validate_below_min())
    results.append(test_coupons_update())
    results.append(test_coupons_validate_inactive())
    results.append(test_coupons_delete())
    
    # TEST GROUP 3: Mobile App APIs (2 tests)
    log("\n" + "=" * 80)
    log("TEST GROUP 3: Mobile App APIs")
    log("=" * 80)
    results.append(test_mobile_app_info())
    results.append(test_mobile_app_download())
    
    # TEST GROUP 4: Suppliers & Purchase Orders APIs (9 tests)
    log("\n" + "=" * 80)
    log("TEST GROUP 4: Suppliers & Purchase Orders APIs")
    log("=" * 80)
    results.append(test_suppliers_create())
    results.append(test_suppliers_list())
    results.append(test_suppliers_update())
    results.append(test_purchase_orders_create())
    results.append(test_purchase_orders_list())
    results.append(test_suppliers_pay())
    results.append(test_suppliers_statement())
    results.append(test_suppliers_delete_with_po())
    
    # TEST GROUP 5: Push Notifications APIs (7 tests)
    log("\n" + "=" * 80)
    log("TEST GROUP 5: Push Notifications APIs")
    log("=" * 80)
    results.append(test_push_vapid_key())
    results.append(test_push_subscriptions_empty())
    results.append(test_push_subscribe())
    results.append(test_push_subscriptions_after_subscribe())
    results.append(test_push_send())
    results.append(test_push_unsubscribe())
    
    # TEST GROUP 6: WhatsApp Templates APIs (3 tests)
    log("\n" + "=" * 80)
    log("TEST GROUP 6: WhatsApp Templates APIs")
    log("=" * 80)
    results.append(test_whatsapp_templates_get())
    results.append(test_whatsapp_templates_update())
    results.append(test_whatsapp_templates_verify_custom())
    
    # TEST GROUP 7: Regression Checks (4 tests)
    log("\n" + "=" * 80)
    log("TEST GROUP 7: Regression Checks")
    log("=" * 80)
    results.append(test_regression_dashboard_stats())
    results.append(test_regression_ai_insights())
    results.append(test_regression_products())
    results.append(test_regression_subscribers())
    
    # Summary
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    passed = sum(results)
    total = len(results)
    log(f"Total: {total} tests")
    log(f"Passed: {passed} tests")
    log(f"Failed: {total - passed} tests")
    log(f"Success Rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        log("\n✅ ALL TESTS PASSED!")
        return 0
    else:
        log(f"\n❌ {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
