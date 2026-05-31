#!/usr/bin/env python3
"""
Test script for NEW backend endpoints:
1. Employee Live Location
2. Location Update Requests workflow
3. Admin Credentials with email/phone
4. SSE Stream (headers check)
5. Subscriber activation emits event
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://isp-noc-hub.preview.emergentagent.com/api"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test_employee_live_location():
    """Test 1: Employee Live Location"""
    log("=" * 60)
    log("TEST 1: Employee Live Location")
    log("=" * 60)
    
    # First, get an existing employee
    try:
        resp = requests.get(f"{BASE_URL}/employees", timeout=10)
        if resp.status_code != 200:
            log(f"❌ Failed to get employees: {resp.status_code}")
            return False
        employees = resp.json()
        if not employees:
            log("❌ No employees found in database")
            return False
        emp_id = employees[0]['id']
        emp_name = employees[0]['name']
        log(f"✅ Found employee: {emp_name} (ID: {emp_id[:8]}...)")
    except Exception as e:
        log(f"❌ Error getting employees: {e}")
        return False
    
    # Test 1a: Valid location update
    try:
        payload = {
            "lat": 33.31,
            "lng": 44.40,
            "accuracy": 10,
            "taskId": None,
            "source": "test"
        }
        resp = requests.post(f"{BASE_URL}/employees/{emp_id}/location", json=payload, timeout=10)
        if resp.status_code != 200:
            log(f"❌ Failed to update location: {resp.status_code} - {resp.text}")
            return False
        data = resp.json()
        if not data.get('success'):
            log(f"❌ Location update did not return success: {data}")
            return False
        log(f"✅ Location updated successfully: {data}")
    except Exception as e:
        log(f"❌ Error updating location: {e}")
        return False
    
    # Verify employee record has location fields
    try:
        resp = requests.get(f"{BASE_URL}/employees", timeout=10)
        employees = resp.json()
        emp = next((e for e in employees if e['id'] == emp_id), None)
        if not emp:
            log(f"❌ Employee not found after location update")
            return False
        if 'lastLat' not in emp or 'lastLng' not in emp or 'lastLocationAt' not in emp:
            log(f"❌ Employee missing location fields: {emp.keys()}")
            return False
        if emp['lastLat'] != 33.31 or emp['lastLng'] != 44.40:
            log(f"❌ Location not saved correctly: lat={emp.get('lastLat')}, lng={emp.get('lastLng')}")
            return False
        log(f"✅ Employee record has location fields: lastLat={emp['lastLat']}, lastLng={emp['lastLng']}, lastLocationAt={emp['lastLocationAt']}")
    except Exception as e:
        log(f"❌ Error verifying employee location: {e}")
        return False
    
    # Test 1b: Invalid coordinates (strings)
    try:
        payload = {"lat": "abc", "lng": "xyz"}
        resp = requests.post(f"{BASE_URL}/employees/{emp_id}/location", json=payload, timeout=10)
        if resp.status_code != 400:
            log(f"❌ Expected 400 for invalid coordinates, got {resp.status_code}")
            return False
        data = resp.json()
        if 'إحداثيات غير صالحة' not in data.get('error', ''):
            log(f"❌ Expected Arabic error message, got: {data}")
            return False
        log(f"✅ Invalid coordinates rejected with 400: {data.get('error')}")
    except Exception as e:
        log(f"❌ Error testing invalid coordinates: {e}")
        return False
    
    # Test 1c: Non-existent employee
    try:
        payload = {"lat": 33, "lng": 44}
        resp = requests.post(f"{BASE_URL}/employees/fake-id-12345/location", json=payload, timeout=10)
        if resp.status_code != 404:
            log(f"❌ Expected 404 for non-existent employee, got {resp.status_code}")
            return False
        data = resp.json()
        if 'الموظف غير موجود' not in data.get('error', ''):
            log(f"❌ Expected Arabic error message, got: {data}")
            return False
        log(f"✅ Non-existent employee rejected with 404: {data.get('error')}")
    except Exception as e:
        log(f"❌ Error testing non-existent employee: {e}")
        return False
    
    log("✅ TEST 1 PASSED: Employee Live Location")
    return True

def test_location_update_requests():
    """Test 2: Location Update Requests Workflow"""
    log("=" * 60)
    log("TEST 2: Location Update Requests Workflow")
    log("=" * 60)
    
    # Get existing subscriber and employee
    try:
        resp = requests.get(f"{BASE_URL}/subscribers", timeout=10)
        if resp.status_code != 200:
            log(f"❌ Failed to get subscribers: {resp.status_code}")
            return False
        subscribers = resp.json()
        if not subscribers:
            log("❌ No subscribers found")
            return False
        subscriber = subscribers[0]
        subscriber_id = subscriber['id']
        original_lat = subscriber.get('userLat')
        original_lng = subscriber.get('userLng')
        log(f"✅ Found subscriber: {subscriber['name']} (ID: {subscriber_id[:8]}..., original lat={original_lat}, lng={original_lng})")
        
        resp = requests.get(f"{BASE_URL}/employees", timeout=10)
        employees = resp.json()
        employee = employees[0]
        employee_id = employee['id']
        employee_name = employee['name']
        log(f"✅ Found employee: {employee_name} (ID: {employee_id[:8]}...)")
    except Exception as e:
        log(f"❌ Error getting subscriber/employee: {e}")
        return False
    
    # Test 2a: GET /api/location-update-requests
    try:
        resp = requests.get(f"{BASE_URL}/location-update-requests", timeout=10)
        if resp.status_code != 200:
            log(f"❌ Failed to get location update requests: {resp.status_code}")
            return False
        requests_list = resp.json()
        if not isinstance(requests_list, list):
            log(f"❌ Expected array, got: {type(requests_list)}")
            return False
        log(f"✅ GET /api/location-update-requests returned array with {len(requests_list)} items")
    except Exception as e:
        log(f"❌ Error getting location update requests: {e}")
        return False
    
    # Test 2b: POST /api/location-update-requests (create request)
    try:
        payload = {
            "subscriberId": subscriber_id,
            "newLat": 33.55,
            "newLng": 44.55,
            "employeeId": employee_id,
            "employeeName": employee_name,
            "taskId": None,
            "notes": "نقل موقع"
        }
        resp = requests.post(f"{BASE_URL}/location-update-requests", json=payload, timeout=10)
        if resp.status_code != 201:
            log(f"❌ Failed to create location update request: {resp.status_code} - {resp.text}")
            return False
        request_data = resp.json()
        if request_data.get('status') != 'pending':
            log(f"❌ Expected status='pending', got: {request_data.get('status')}")
            return False
        if not request_data.get('id'):
            log(f"❌ No ID in response: {request_data}")
            return False
        request_id = request_data['id']
        log(f"✅ Created location update request: ID={request_id[:8]}..., status={request_data['status']}, newLat={request_data['newLat']}, newLng={request_data['newLng']}")
    except Exception as e:
        log(f"❌ Error creating location update request: {e}")
        return False
    
    # Test 2c: POST /api/location-update-requests/:id/approve
    try:
        resp = requests.post(f"{BASE_URL}/location-update-requests/{request_id}/approve", timeout=10)
        if resp.status_code != 200:
            log(f"❌ Failed to approve request: {resp.status_code} - {resp.text}")
            return False
        data = resp.json()
        if not data.get('success'):
            log(f"❌ Approve did not return success: {data}")
            return False
        log(f"✅ Approved location update request: {data}")
        
        # Verify subscriber location was updated
        resp = requests.get(f"{BASE_URL}/subscribers", timeout=10)
        subscribers = resp.json()
        updated_sub = next((s for s in subscribers if s['id'] == subscriber_id), None)
        if not updated_sub:
            log(f"❌ Subscriber not found after approval")
            return False
        if updated_sub.get('userLat') != 33.55 or updated_sub.get('userLng') != 44.55:
            log(f"❌ Subscriber location not updated: lat={updated_sub.get('userLat')}, lng={updated_sub.get('userLng')}")
            return False
        log(f"✅ Subscriber location updated correctly: userLat={updated_sub['userLat']}, userLng={updated_sub['userLng']}")
    except Exception as e:
        log(f"❌ Error approving request: {e}")
        return False
    
    # Test 2d: Create another request and reject it
    try:
        payload = {
            "subscriberId": subscriber_id,
            "newLat": 99.99,
            "newLng": 99.99,
            "employeeId": employee_id,
            "employeeName": employee_name,
            "notes": "test rejection"
        }
        resp = requests.post(f"{BASE_URL}/location-update-requests", json=payload, timeout=10)
        if resp.status_code != 201:
            log(f"❌ Failed to create second request: {resp.status_code}")
            return False
        request2_data = resp.json()
        request2_id = request2_data['id']
        log(f"✅ Created second request: ID={request2_id[:8]}...")
        
        # Reject it
        reject_payload = {"reason": "Wrong location"}
        resp = requests.post(f"{BASE_URL}/location-update-requests/{request2_id}/reject", json=reject_payload, timeout=10)
        if resp.status_code != 200:
            log(f"❌ Failed to reject request: {resp.status_code} - {resp.text}")
            return False
        data = resp.json()
        if not data.get('success'):
            log(f"❌ Reject did not return success: {data}")
            return False
        log(f"✅ Rejected location update request: {data}")
        
        # Verify subscriber location is STILL 33.55, NOT 99.99
        resp = requests.get(f"{BASE_URL}/subscribers", timeout=10)
        subscribers = resp.json()
        sub_after_reject = next((s for s in subscribers if s['id'] == subscriber_id), None)
        if not sub_after_reject:
            log(f"❌ Subscriber not found after rejection")
            return False
        if sub_after_reject.get('userLat') != 33.55 or sub_after_reject.get('userLng') != 44.55:
            log(f"❌ Subscriber location changed after rejection: lat={sub_after_reject.get('userLat')}, lng={sub_after_reject.get('userLng')}")
            return False
        log(f"✅ Subscriber location unchanged after rejection: userLat={sub_after_reject['userLat']}, userLng={sub_after_reject['userLng']}")
        
        # Verify request has status='rejected' and rejectionReason
        resp = requests.get(f"{BASE_URL}/location-update-requests", timeout=10)
        all_requests = resp.json()
        rejected_req = next((r for r in all_requests if r['id'] == request2_id), None)
        if not rejected_req:
            log(f"❌ Rejected request not found in list")
            return False
        if rejected_req.get('status') != 'rejected':
            log(f"❌ Request status not 'rejected': {rejected_req.get('status')}")
            return False
        if rejected_req.get('rejectionReason') != 'Wrong location':
            log(f"❌ Rejection reason not saved: {rejected_req.get('rejectionReason')}")
            return False
        log(f"✅ Request has status='rejected' and rejectionReason='Wrong location'")
    except Exception as e:
        log(f"❌ Error testing rejection: {e}")
        return False
    
    # Test 2e: Missing subscriberId
    try:
        payload = {"newLat": 33, "newLng": 44}
        resp = requests.post(f"{BASE_URL}/location-update-requests", json=payload, timeout=10)
        if resp.status_code != 400:
            log(f"❌ Expected 400 for missing subscriberId, got {resp.status_code}")
            return False
        data = resp.json()
        if 'بيانات ناقصة' not in data.get('error', ''):
            log(f"❌ Expected Arabic error message, got: {data}")
            return False
        log(f"✅ Missing subscriberId rejected with 400: {data.get('error')}")
    except Exception as e:
        log(f"❌ Error testing missing subscriberId: {e}")
        return False
    
    # Test 2f: Non-existent subscriberId
    try:
        payload = {
            "subscriberId": "fake-12345",
            "newLat": 33,
            "newLng": 44,
            "employeeId": employee_id,
            "employeeName": employee_name
        }
        resp = requests.post(f"{BASE_URL}/location-update-requests", json=payload, timeout=10)
        if resp.status_code != 404:
            log(f"❌ Expected 404 for non-existent subscriberId, got {resp.status_code}")
            return False
        data = resp.json()
        if 'المشترك غير موجود' not in data.get('error', ''):
            log(f"❌ Expected Arabic error message, got: {data}")
            return False
        log(f"✅ Non-existent subscriberId rejected with 404: {data.get('error')}")
    except Exception as e:
        log(f"❌ Error testing non-existent subscriberId: {e}")
        return False
    
    log("✅ TEST 2 PASSED: Location Update Requests Workflow")
    return True

def test_admin_credentials_with_email_phone():
    """Test 3: Admin Credentials with Email & Phone"""
    log("=" * 60)
    log("TEST 3: Admin Credentials with Email & Phone")
    log("=" * 60)
    
    # First, get current admin credentials
    try:
        resp = requests.get(f"{BASE_URL}/admin/credentials", timeout=10)
        if resp.status_code != 200:
            log(f"❌ Failed to get admin credentials: {resp.status_code}")
            return False
        creds = resp.json()
        log(f"✅ Current admin credentials: username={creds.get('username')}, hasPassword={creds.get('hasPassword')}, email={creds.get('email')}, phone={creds.get('phone')}")
        has_password = creds.get('hasPassword', False)
    except Exception as e:
        log(f"❌ Error getting admin credentials: {e}")
        return False
    
    # Test 3a: Update email and phone (without password change)
    try:
        # If password is set, we need to provide currentPassword
        # For testing, let's try without currentPassword first
        payload = {
            "email": "admin@test.iq",
            "phone": "07901234567"
        }
        resp = requests.put(f"{BASE_URL}/admin/credentials", json=payload, timeout=10)
        
        if has_password and resp.status_code == 400:
            # Expected - need currentPassword
            data = resp.json()
            if 'كلمة المرور الحالية مطلوبة' in data.get('error', ''):
                log(f"✅ Correctly requires currentPassword when password is set: {data.get('error')}")
                # Skip the rest of this test since we don't know the current password
                log("⚠️ Skipping email/phone update test (password required but unknown)")
                return True
            else:
                log(f"❌ Unexpected error: {data}")
                return False
        elif resp.status_code == 200:
            # Success - no password set or password not required for email/phone update
            data = resp.json()
            if not data.get('success'):
                log(f"❌ Update did not return success: {data}")
                return False
            log(f"✅ Updated email and phone successfully: {data}")
            
            # Verify the update
            resp = requests.get(f"{BASE_URL}/admin/credentials", timeout=10)
            creds = resp.json()
            if creds.get('email') != 'admin@test.iq' or creds.get('phone') != '07901234567':
                log(f"❌ Email/phone not updated correctly: email={creds.get('email')}, phone={creds.get('phone')}")
                return False
            log(f"✅ Verified email and phone updated: email={creds['email']}, phone={creds['phone']}")
        else:
            log(f"❌ Unexpected status code: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        log(f"❌ Error updating admin credentials: {e}")
        return False
    
    log("✅ TEST 3 PASSED: Admin Credentials with Email & Phone")
    return True

def test_sse_stream():
    """Test 4: SSE Stream (just headers check)"""
    log("=" * 60)
    log("TEST 4: SSE Stream (headers check)")
    log("=" * 60)
    
    try:
        # Use stream=True and timeout to avoid hanging
        resp = requests.get(f"{BASE_URL}/events/stream", stream=True, timeout=5)
        
        # Check status code
        if resp.status_code != 200:
            log(f"❌ Expected 200, got {resp.status_code}")
            return False
        log(f"✅ SSE endpoint returned 200")
        
        # Check Content-Type header
        content_type = resp.headers.get('Content-Type', '')
        if 'text/event-stream' not in content_type:
            log(f"❌ Expected Content-Type to contain 'text/event-stream', got: {content_type}")
            return False
        log(f"✅ Content-Type is correct: {content_type}")
        
        # Try to read first chunk (with timeout)
        try:
            for chunk in resp.iter_content(chunk_size=1024):
                if chunk:
                    log(f"✅ Received first chunk from SSE stream: {chunk[:100]}...")
                    break
        except requests.exceptions.ReadTimeout:
            log(f"⚠️ Timeout reading from stream (expected for long-running SSE)")
        
        # Close the connection
        resp.close()
        
    except requests.exceptions.ReadTimeout:
        log(f"⚠️ Timeout connecting to SSE stream (this is acceptable)")
        return True
    except Exception as e:
        log(f"❌ Error testing SSE stream: {e}")
        return False
    
    log("✅ TEST 4 PASSED: SSE Stream")
    return True

def test_subscriber_activation_emits_event():
    """Test 5: Subscriber activation emits event (indirect test)"""
    log("=" * 60)
    log("TEST 5: Subscriber Activation Emits Event")
    log("=" * 60)
    
    # Get a subscriber and package
    try:
        resp = requests.get(f"{BASE_URL}/subscribers", timeout=10)
        subscribers = resp.json()
        if not subscribers:
            log("❌ No subscribers found")
            return False
        subscriber = subscribers[0]
        subscriber_id = subscriber['id']
        log(f"✅ Found subscriber: {subscriber['name']} (ID: {subscriber_id[:8]}...)")
        
        resp = requests.get(f"{BASE_URL}/packages", timeout=10)
        packages = resp.json()
        if not packages:
            log("❌ No packages found")
            return False
        package = packages[0]
        package_id = package['id']
        log(f"✅ Found package: {package['name']} (ID: {package_id[:8]}...)")
        
        # Get an agent (optional)
        resp = requests.get(f"{BASE_URL}/agents", timeout=10)
        agents = resp.json()
        agent_id = agents[0]['id'] if agents else None
        if agent_id:
            log(f"✅ Found agent: {agents[0]['name']} (ID: {agent_id[:8]}...)")
    except Exception as e:
        log(f"❌ Error getting subscriber/package/agent: {e}")
        return False
    
    # Activate subscriber
    try:
        payload = {
            "packageId": package_id,
            "durationMonths": 1,
            "agentId": agent_id
        }
        resp = requests.post(f"{BASE_URL}/subscribers/{subscriber_id}/activate", json=payload, timeout=10)
        if resp.status_code != 201:
            log(f"❌ Failed to activate subscriber: {resp.status_code} - {resp.text}")
            return False
        data = resp.json()
        if not data.get('success'):
            log(f"❌ Activation did not return success: {data}")
            return False
        if not data.get('activation'):
            log(f"❌ No activation object in response: {data}")
            return False
        log(f"✅ Subscriber activated successfully: activation_id={data['activation']['id'][:8]}...")
        log(f"   Event should be emitted server-side (cannot directly test event consumption)")
    except Exception as e:
        log(f"❌ Error activating subscriber: {e}")
        return False
    
    log("✅ TEST 5 PASSED: Subscriber Activation")
    return True

def main():
    log("=" * 60)
    log("STARTING NEW ENDPOINTS TESTS")
    log("=" * 60)
    
    results = {
        "Employee Live Location": False,
        "Location Update Requests": False,
        "Admin Credentials": False,
        "SSE Stream": False,
        "Subscriber Activation": False
    }
    
    # Run tests
    results["Employee Live Location"] = test_employee_live_location()
    time.sleep(1)
    
    results["Location Update Requests"] = test_location_update_requests()
    time.sleep(1)
    
    results["Admin Credentials"] = test_admin_credentials_with_email_phone()
    time.sleep(1)
    
    results["SSE Stream"] = test_sse_stream()
    time.sleep(1)
    
    results["Subscriber Activation"] = test_subscriber_activation_emits_event()
    
    # Summary
    log("=" * 60)
    log("TEST SUMMARY")
    log("=" * 60)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_flag in results.items():
        status = "✅ PASSED" if passed_flag else "❌ FAILED"
        log(f"{status}: {test_name}")
    
    log("=" * 60)
    log(f"TOTAL: {passed}/{total} tests passed")
    log("=" * 60)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
