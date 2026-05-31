#!/usr/bin/env python3
"""
WhatsApp Web Integration Test Script
Tests the NEW whatsapp-web.js microservice integration endpoints.
"""

import requests
import json
import sys
from datetime import datetime
import time

# Base URL from environment
BASE_URL = "https://isp-noc-hub.preview.emergentagent.com/api"

def log(msg):
    """Print timestamped log message"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_whatsapp_integration():
    """Test WhatsApp Web Integration endpoints"""
    
    log("=" * 80)
    log("WHATSAPP WEB INTEGRATION TESTING (whatsapp-web.js microservice)")
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
    
    # Store data for later tests
    test_data = {
        "subscriber_id": None,
        "original_templates": None,
        "test_message_id": None
    }
    
    try:
        # ============================================================
        # TEST 1: GET /api/whatsapp/status
        # ============================================================
        log("\n--- TEST 1: GET /api/whatsapp/status ---")
        try:
            response = requests.get(f"{BASE_URL}/whatsapp/status", timeout=10)
            log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                log(f"Response: {json.dumps(data, indent=2)}")
                
                # Check required fields
                required_fields = ['configured', 'serviceUp', 'status']
                has_all_fields = all(field in data for field in required_fields)
                
                if has_all_fields:
                    # Verify configured is true (env vars are set)
                    if data.get('configured') == True:
                        record_test("GET /api/whatsapp/status - configured=true", True, 
                                   f"configured={data['configured']}, serviceUp={data.get('serviceUp')}, status={data.get('status')}")
                    else:
                        record_test("GET /api/whatsapp/status - configured=true", False,
                                   f"configured={data['configured']} (expected true)")
                    
                    # Verify serviceUp is true (whatsapp-service is running)
                    if data.get('serviceUp') == True:
                        record_test("GET /api/whatsapp/status - serviceUp=true", True,
                                   f"WhatsApp service is running on port 3001")
                    else:
                        record_test("GET /api/whatsapp/status - serviceUp=true", False,
                                   f"serviceUp={data.get('serviceUp')} (expected true)")
                    
                    # Verify status is one of expected values
                    valid_statuses = ['disconnected', 'qr', 'ready', 'initializing', 'auth_failure']
                    if data.get('status') in valid_statuses:
                        record_test("GET /api/whatsapp/status - valid status", True,
                                   f"status={data.get('status')}")
                    else:
                        record_test("GET /api/whatsapp/status - valid status", False,
                                   f"status={data.get('status')} not in {valid_statuses}")
                else:
                    record_test("GET /api/whatsapp/status - has required fields", False,
                               f"Missing fields. Got: {list(data.keys())}")
            else:
                record_test("GET /api/whatsapp/status returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("GET /api/whatsapp/status", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 2: GET /api/whatsapp/templates
        # ============================================================
        log("\n--- TEST 2: GET /api/whatsapp/templates ---")
        try:
            response = requests.get(f"{BASE_URL}/whatsapp/templates", timeout=10)
            log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                log(f"Response keys: {list(data.keys())}")
                
                # Check for templates and defaults keys
                if 'templates' in data and 'defaults' in data:
                    templates = data['templates']
                    defaults = data['defaults']
                    
                    # Check all 6 default template keys are present
                    expected_keys = ['activation', 'expiry', 'expiry_alert', 'debt', 'receipt', 'generic']
                    templates_has_all = all(key in templates for key in expected_keys)
                    defaults_has_all = all(key in defaults for key in expected_keys)
                    
                    # Check all templates are non-empty strings
                    all_non_empty = all(isinstance(templates.get(key), str) and len(templates.get(key)) > 0 
                                       for key in expected_keys)
                    
                    if templates_has_all and defaults_has_all and all_non_empty:
                        record_test("GET /api/whatsapp/templates - all 6 keys present and non-empty", True,
                                   f"Found all keys: {expected_keys}")
                        # Store original templates for later reset
                        test_data["original_templates"] = templates
                    else:
                        record_test("GET /api/whatsapp/templates - all 6 keys present and non-empty", False,
                                   f"Missing keys or empty values. templates keys: {list(templates.keys())}")
                else:
                    record_test("GET /api/whatsapp/templates - has templates and defaults", False,
                               f"Missing keys. Got: {list(data.keys())}")
            else:
                record_test("GET /api/whatsapp/templates returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("GET /api/whatsapp/templates", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 3: PUT /api/whatsapp/templates (update)
        # ============================================================
        log("\n--- TEST 3: PUT /api/whatsapp/templates (update) ---")
        try:
            test_template = {"activation": "Test {name} - تم التفعيل"}
            response = requests.put(f"{BASE_URL}/whatsapp/templates", 
                                   json={"templates": test_template}, 
                                   timeout=10)
            log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') == True:
                    record_test("PUT /api/whatsapp/templates - update success", True,
                               "Template updated successfully")
                    
                    # Verify persistence by GET
                    time.sleep(0.5)
                    verify_response = requests.get(f"{BASE_URL}/whatsapp/templates", timeout=10)
                    if verify_response.status_code == 200:
                        verify_data = verify_response.json()
                        if verify_data['templates'].get('activation') == "Test {name} - تم التفعيل":
                            record_test("PUT /api/whatsapp/templates - persistence verified", True,
                                       "Updated template persisted correctly")
                        else:
                            record_test("PUT /api/whatsapp/templates - persistence verified", False,
                                       f"Template not persisted. Got: {verify_data['templates'].get('activation')}")
                    else:
                        record_test("PUT /api/whatsapp/templates - persistence check", False,
                                   f"Verify GET failed with {verify_response.status_code}")
                else:
                    record_test("PUT /api/whatsapp/templates - update success", False,
                               f"success={data.get('success')}")
            else:
                record_test("PUT /api/whatsapp/templates returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("PUT /api/whatsapp/templates", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 4: PUT /api/whatsapp/templates (reset to original)
        # ============================================================
        log("\n--- TEST 4: PUT /api/whatsapp/templates (reset) ---")
        if test_data["original_templates"]:
            try:
                response = requests.put(f"{BASE_URL}/whatsapp/templates", 
                                       json={"templates": test_data["original_templates"]}, 
                                       timeout=10)
                log(f"Status: {response.status_code}")
                
                if response.status_code == 200:
                    record_test("PUT /api/whatsapp/templates - reset to original", True,
                               "Templates reset successfully")
                else:
                    record_test("PUT /api/whatsapp/templates - reset", False, f"Got {response.status_code}")
            except Exception as e:
                record_test("PUT /api/whatsapp/templates - reset", False, f"Exception: {str(e)}")
        else:
            log("Skipping reset - no original templates stored")
        
        # ============================================================
        # TEST 5: POST /api/whatsapp/connect
        # ============================================================
        log("\n--- TEST 5: POST /api/whatsapp/connect ---")
        try:
            response = requests.post(f"{BASE_URL}/whatsapp/connect", json={}, timeout=15)
            log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                log(f"Response: {json.dumps(data, indent=2)}")
                
                # Should return status (initializing or qr etc)
                if 'status' in data:
                    record_test("POST /api/whatsapp/connect - returns status", True,
                               f"status={data.get('status')}")
                else:
                    record_test("POST /api/whatsapp/connect - returns status", False,
                               f"No status field. Got: {list(data.keys())}")
            else:
                record_test("POST /api/whatsapp/connect returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("POST /api/whatsapp/connect", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 6: GET /api/whatsapp/qr
        # ============================================================
        log("\n--- TEST 6: GET /api/whatsapp/qr ---")
        try:
            # Wait a bit for QR to potentially generate
            time.sleep(2)
            response = requests.get(f"{BASE_URL}/whatsapp/qr", timeout=10)
            log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                log(f"Response keys: {list(data.keys())}")
                
                # Should have qrDataUrl (may be null) and status
                if 'qrDataUrl' in data and 'status' in data:
                    qr_data = data.get('qrDataUrl')
                    if qr_data is None or (isinstance(qr_data, str) and qr_data.startswith('data:image/png;base64,')):
                        record_test("GET /api/whatsapp/qr - valid response", True,
                                   f"qrDataUrl={'present' if qr_data else 'null'}, status={data.get('status')}")
                    else:
                        record_test("GET /api/whatsapp/qr - valid qrDataUrl format", False,
                                   f"Invalid qrDataUrl format: {qr_data[:50] if qr_data else 'null'}")
                else:
                    record_test("GET /api/whatsapp/qr - has required fields", False,
                               f"Missing fields. Got: {list(data.keys())}")
            else:
                record_test("GET /api/whatsapp/qr returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("GET /api/whatsapp/qr", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 7: Get a subscriber for testing send
        # ============================================================
        log("\n--- TEST 7: Get existing subscriber for send tests ---")
        try:
            response = requests.get(f"{BASE_URL}/subscribers", timeout=10)
            if response.status_code == 200:
                subscribers = response.json()
                if isinstance(subscribers, list) and len(subscribers) > 0:
                    # Find subscriber with phone
                    for sub in subscribers:
                        if sub.get('phone'):
                            test_data["subscriber_id"] = sub.get('id')
                            log(f"Found subscriber: {sub.get('name')} (id={sub.get('id')}, phone={sub.get('phone')})")
                            break
                    
                    if test_data["subscriber_id"]:
                        record_test("Found subscriber with phone for testing", True,
                                   f"subscriber_id={test_data['subscriber_id']}")
                    else:
                        record_test("Found subscriber with phone", False, "No subscriber with phone found")
                else:
                    record_test("Get subscribers", False, "No subscribers in database")
            else:
                record_test("Get subscribers", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("Get subscribers", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 8: POST /api/whatsapp/send (with subscriberId)
        # ============================================================
        log("\n--- TEST 8: POST /api/whatsapp/send (with subscriberId) ---")
        if test_data["subscriber_id"]:
            try:
                payload = {
                    "subscriberId": test_data["subscriber_id"],
                    "templateKey": "expiry_alert",
                    "vars": {"daysLeft": 5}
                }
                response = requests.post(f"{BASE_URL}/whatsapp/send", json=payload, timeout=15)
                log(f"Status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    log(f"Response: {json.dumps(data, indent=2)}")
                    
                    # Should return 200 (not 500) - message should be persisted even if not sent
                    # Expected: {success: false, queued: true} OR {success: false, error: "whatsapp_not_ready"}
                    if 'success' in data or 'queued' in data or 'error' in data:
                        record_test("POST /api/whatsapp/send (subscriberId) - returns 200 (not 500)", True,
                                   f"Response: success={data.get('success')}, queued={data.get('queued')}, error={data.get('error')}")
                        
                        # Verify message was persisted
                        time.sleep(0.5)
                        verify_response = requests.get(f"{BASE_URL}/whatsapp/messages?type=expiry_alert&limit=5", timeout=10)
                        if verify_response.status_code == 200:
                            messages = verify_response.json()
                            if isinstance(messages, list) and len(messages) > 0:
                                # Check if our message is in the list
                                found = any(msg.get('type') == 'expiry_alert' for msg in messages)
                                if found:
                                    record_test("POST /api/whatsapp/send - message persisted", True,
                                               f"Found {len(messages)} expiry_alert messages")
                                    # Store message ID for later
                                    test_data["test_message_id"] = messages[0].get('id')
                                else:
                                    record_test("POST /api/whatsapp/send - message persisted", False,
                                               "No expiry_alert message found")
                            else:
                                record_test("POST /api/whatsapp/send - message persisted", False,
                                           "No messages returned")
                        else:
                            record_test("POST /api/whatsapp/send - verify persistence", False,
                                       f"Verify GET failed with {verify_response.status_code}")
                    else:
                        record_test("POST /api/whatsapp/send (subscriberId) - valid response", False,
                                   f"Unexpected response structure: {data}")
                else:
                    record_test("POST /api/whatsapp/send (subscriberId) returns 200", False, 
                               f"Got {response.status_code} - CRITICAL: must NOT return 500")
            except Exception as e:
                record_test("POST /api/whatsapp/send (subscriberId)", False, f"Exception: {str(e)}")
        else:
            log("Skipping - no subscriber_id available")
        
        # ============================================================
        # TEST 9: POST /api/whatsapp/send (with phone)
        # ============================================================
        log("\n--- TEST 9: POST /api/whatsapp/send (with phone) ---")
        try:
            payload = {
                "phone": "07901234567",
                "message": "Hello test - مرحبا اختبار"
            }
            response = requests.post(f"{BASE_URL}/whatsapp/send", json=payload, timeout=15)
            log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                log(f"Response: {json.dumps(data, indent=2)}")
                
                # Should return 200 (not 500) - either sent or queued
                record_test("POST /api/whatsapp/send (phone) - returns 200 (not 500)", True,
                           f"Response: {data}")
            else:
                record_test("POST /api/whatsapp/send (phone) returns 200", False, 
                           f"Got {response.status_code} - CRITICAL: must NOT return 500")
        except Exception as e:
            record_test("POST /api/whatsapp/send (phone)", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 10: POST /api/whatsapp/send-bulk
        # ============================================================
        log("\n--- TEST 10: POST /api/whatsapp/send-bulk ---")
        try:
            payload = {
                "audience": "debt",
                "templateKey": "debt",
                "delayMs": 100
            }
            response = requests.post(f"{BASE_URL}/whatsapp/send-bulk", json=payload, timeout=30)
            log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                log(f"Response: {json.dumps(data, indent=2)}")
                
                # Should have total, sent, failed, batchId, audience
                required_fields = ['total', 'sent', 'failed', 'batchId', 'audience']
                has_all = all(field in data for field in required_fields)
                
                if has_all:
                    # total should equal number of subscribers with debt > 0
                    if data.get('audience') == 'debt':
                        record_test("POST /api/whatsapp/send-bulk - valid response", True,
                                   f"total={data.get('total')}, sent={data.get('sent')}, failed={data.get('failed')}, audience={data.get('audience')}")
                    else:
                        record_test("POST /api/whatsapp/send-bulk - audience field", False,
                                   f"audience={data.get('audience')} (expected 'debt')")
                else:
                    record_test("POST /api/whatsapp/send-bulk - has required fields", False,
                               f"Missing fields. Got: {list(data.keys())}")
            else:
                record_test("POST /api/whatsapp/send-bulk returns 200", False, 
                           f"Got {response.status_code} - CRITICAL: must NOT return 500")
        except Exception as e:
            record_test("POST /api/whatsapp/send-bulk", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 11: GET /api/whatsapp/messages
        # ============================================================
        log("\n--- TEST 11: GET /api/whatsapp/messages ---")
        try:
            response = requests.get(f"{BASE_URL}/whatsapp/messages?status=queued&limit=10", timeout=10)
            log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                log(f"Response: array with {len(data) if isinstance(data, list) else 'N/A'} items")
                
                if isinstance(data, list):
                    if len(data) > 0:
                        # Check first item has required fields
                        first = data[0]
                        required_fields = ['id', 'phone', 'message', 'type', 'status', 'createdAt']
                        has_all = all(field in first for field in required_fields)
                        
                        if has_all:
                            record_test("GET /api/whatsapp/messages - valid structure", True,
                                       f"Found {len(data)} messages with all required fields")
                        else:
                            record_test("GET /api/whatsapp/messages - item structure", False,
                                       f"Missing fields. Got: {list(first.keys())}")
                    else:
                        record_test("GET /api/whatsapp/messages - returns array", True,
                                   "Empty array (no queued messages)")
                else:
                    record_test("GET /api/whatsapp/messages - returns array", False,
                               f"Not an array. Type: {type(data)}")
            else:
                record_test("GET /api/whatsapp/messages returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("GET /api/whatsapp/messages", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 12: POST /api/whatsapp/webhook
        # ============================================================
        log("\n--- TEST 12: POST /api/whatsapp/webhook ---")
        try:
            payload = {
                "event": "test",
                "data": {"foo": "bar", "timestamp": datetime.now().isoformat()}
            }
            response = requests.post(f"{BASE_URL}/whatsapp/webhook", json=payload, timeout=10)
            log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                log(f"Response: {json.dumps(data, indent=2)}")
                
                if data.get('received') == True:
                    record_test("POST /api/whatsapp/webhook - returns received:true", True,
                               "Webhook received successfully")
                else:
                    record_test("POST /api/whatsapp/webhook - received field", False,
                               f"received={data.get('received')}")
            else:
                record_test("POST /api/whatsapp/webhook returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("POST /api/whatsapp/webhook", False, f"Exception: {str(e)}")
        
        # ============================================================
        # TEST 13: POST /api/whatsapp/disconnect
        # ============================================================
        log("\n--- TEST 13: POST /api/whatsapp/disconnect ---")
        try:
            payload = {"wipe": False}
            response = requests.post(f"{BASE_URL}/whatsapp/disconnect", json=payload, timeout=10)
            log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                log(f"Response: {json.dumps(data, indent=2)}")
                record_test("POST /api/whatsapp/disconnect - returns 200", True,
                           "Disconnected successfully")
                
                # Verify status is now disconnected
                time.sleep(1)
                verify_response = requests.get(f"{BASE_URL}/whatsapp/status", timeout=10)
                if verify_response.status_code == 200:
                    verify_data = verify_response.json()
                    if verify_data.get('status') == 'disconnected':
                        record_test("POST /api/whatsapp/disconnect - status is disconnected", True,
                                   f"status={verify_data.get('status')}")
                    else:
                        record_test("POST /api/whatsapp/disconnect - status is disconnected", False,
                                   f"status={verify_data.get('status')} (expected 'disconnected')")
            else:
                record_test("POST /api/whatsapp/disconnect returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("POST /api/whatsapp/disconnect", False, f"Exception: {str(e)}")
        
        # ============================================================
        # REGRESSION CHECKS
        # ============================================================
        log("\n" + "=" * 80)
        log("REGRESSION CHECKS - Verify existing endpoints still work")
        log("=" * 80)
        
        # TEST 14: GET /api/dashboard/stats
        log("\n--- TEST 14: GET /api/dashboard/stats (regression) ---")
        try:
            response = requests.get(f"{BASE_URL}/dashboard/stats", timeout=10)
            log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if 'totalProducts' in data and 'totalSubscribers' in data:
                    record_test("GET /api/dashboard/stats - still works", True,
                               f"totalProducts={data.get('totalProducts')}, totalSubscribers={data.get('totalSubscribers')}")
                else:
                    record_test("GET /api/dashboard/stats - still works", False,
                               f"Missing expected fields")
            else:
                record_test("GET /api/dashboard/stats returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("GET /api/dashboard/stats", False, f"Exception: {str(e)}")
        
        # TEST 15: GET /api/subscribers
        log("\n--- TEST 15: GET /api/subscribers (regression) ---")
        try:
            response = requests.get(f"{BASE_URL}/subscribers", timeout=10)
            log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    record_test("GET /api/subscribers - still works", True,
                               f"Found {len(data)} subscribers")
                else:
                    record_test("GET /api/subscribers - still works", False,
                               f"Not an array")
            else:
                record_test("GET /api/subscribers returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("GET /api/subscribers", False, f"Exception: {str(e)}")
        
        # TEST 16: GET /api/notifications/admin
        log("\n--- TEST 16: GET /api/notifications/admin (regression) ---")
        try:
            response = requests.get(f"{BASE_URL}/notifications/admin", timeout=10)
            log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    record_test("GET /api/notifications/admin - still works", True,
                               f"Found {len(data)} notifications")
                else:
                    record_test("GET /api/notifications/admin - still works", False,
                               f"Not an array")
            else:
                record_test("GET /api/notifications/admin returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("GET /api/notifications/admin", False, f"Exception: {str(e)}")
        
        # TEST 17: GET /api/health
        log("\n--- TEST 17: GET /api/health (regression) ---")
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=10)
            log(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('dbConnected') == True:
                    record_test("GET /api/health - dbConnected=true", True,
                               f"status={data.get('status')}, dbConnected={data.get('dbConnected')}")
                else:
                    record_test("GET /api/health - dbConnected", False,
                               f"dbConnected={data.get('dbConnected')}")
            else:
                record_test("GET /api/health returns 200", False, f"Got {response.status_code}")
        except Exception as e:
            record_test("GET /api/health", False, f"Exception: {str(e)}")
        
    except Exception as e:
        log(f"\n❌ FATAL ERROR: {str(e)}")
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
    
    if test_results['failed'] > 0:
        log("\nFailed Tests:")
        for test in test_results['tests']:
            if not test['passed']:
                log(f"  - {test['name']}")
                if test['details']:
                    log(f"    {test['details']}")
    
    log("\n" + "=" * 80)
    
    return test_results['failed'] == 0

if __name__ == "__main__":
    success = test_whatsapp_integration()
    sys.exit(0 if success else 1)
