#!/usr/bin/env python3
"""
Focused test for notification endpoints and admin-complete
"""

import requests
import json
import time

BASE_URL = "https://isp-noc-hub.preview.emergentagent.com/api"

def test_notifications():
    """Test notification endpoints"""
    print("\n" + "="*80)
    print("FOCUSED TEST: Notification Endpoints")
    print("="*80)
    
    # Try multiple times with delay
    for attempt in range(3):
        print(f"\nAttempt {attempt + 1}/3...")
        try:
            resp = requests.get(f"{BASE_URL}/notifications/admin", timeout=30)
            print(f"Status: {resp.status_code}")
            
            if resp.status_code == 200:
                notifications = resp.json()
                print(f"✅ Got {len(notifications)} notifications")
                
                if len(notifications) > 0:
                    notif_id = notifications[0]['id']
                    print(f"Using notification ID: {notif_id}")
                    
                    # Test click
                    print("\n--- Testing click ---")
                    resp = requests.post(f"{BASE_URL}/notifications/{notif_id}/click")
                    print(f"Click status: {resp.status_code}")
                    if resp.status_code == 200:
                        data = resp.json()
                        print(f"✅ Click response: {json.dumps(data, indent=2)}")
                    else:
                        print(f"❌ Click failed: {resp.text}")
                    
                    # Test resolve
                    print("\n--- Testing resolve ---")
                    payload = {"note": "تمت المعالجة", "resolvedBy": "المدير"}
                    resp = requests.post(f"{BASE_URL}/notifications/{notif_id}/resolve", json=payload)
                    print(f"Resolve status: {resp.status_code}")
                    if resp.status_code == 200:
                        data = resp.json()
                        print(f"✅ Resolve response: {json.dumps(data, indent=2)}")
                    else:
                        print(f"❌ Resolve failed: {resp.text}")
                    
                    # Test reopen
                    print("\n--- Testing reopen ---")
                    resp = requests.post(f"{BASE_URL}/notifications/{notif_id}/reopen")
                    print(f"Reopen status: {resp.status_code}")
                    if resp.status_code == 200:
                        data = resp.json()
                        print(f"✅ Reopen response: {json.dumps(data, indent=2)}")
                    else:
                        print(f"❌ Reopen failed: {resp.text}")
                    
                    # Test delete
                    print("\n--- Testing delete ---")
                    resp = requests.post(f"{BASE_URL}/notifications/{notif_id}/delete")
                    print(f"Delete POST status: {resp.status_code}")
                    if resp.status_code != 200:
                        # Try DELETE method
                        resp = requests.delete(f"{BASE_URL}/notifications/{notif_id}")
                        print(f"Delete DELETE status: {resp.status_code}")
                    
                    if resp.status_code == 200:
                        data = resp.json()
                        print(f"✅ Delete response: {json.dumps(data, indent=2)}")
                    else:
                        print(f"❌ Delete failed: {resp.text}")
                    
                    return
                else:
                    print("❌ No notifications found")
                    return
            else:
                print(f"❌ Failed with status {resp.status_code}: {resp.text}")
                
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
        
        if attempt < 2:
            print("Waiting 2 seconds before retry...")
            time.sleep(2)

def test_admin_complete():
    """Test admin-complete with proper timing"""
    print("\n" + "="*80)
    print("FOCUSED TEST: Admin Complete Endpoint")
    print("="*80)
    
    try:
        # Create task
        task_payload = {
            "title": "مهمة اختبار الإكمال",
            "assignedTo": "test-emp-001",
            "assignedToName": "موظف اختبار",
            "priority": "high",
            "dueDate": "2026-12-31"
        }
        
        resp = requests.post(f"{BASE_URL}/tasks", json=task_payload)
        if resp.status_code not in [200, 201]:
            print(f"❌ Failed to create task: {resp.status_code}")
            return
        
        task = resp.json()
        task_id = task.get('id')
        print(f"✅ Created task: {task_id}")
        
        # Start task
        start_payload = {"userName": "موظف اختبار"}
        resp = requests.post(f"{BASE_URL}/tasks/{task_id}/start", json=start_payload)
        if resp.status_code != 200:
            print(f"❌ Failed to start task: {resp.status_code}")
            return
        
        data = resp.json()
        print(f"✅ Started task at: {data.get('startedAt')}")
        
        # Wait 2 seconds to ensure some duration
        print("Waiting 2 seconds to ensure duration > 0...")
        time.sleep(2)
        
        # Admin complete
        complete_payload = {
            "note": "تم بنجاح",
            "userName": "المدير"
        }
        resp = requests.post(f"{BASE_URL}/tasks/{task_id}/admin-complete", json=complete_payload)
        
        print(f"Admin-complete status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            duration = data.get('durationMin')
            if duration is not None:
                if duration > 0:
                    print(f"✅ durationMin is valid: {duration} minutes")
                else:
                    print(f"⚠️  durationMin is 0 (task completed too quickly)")
                    print("This is technically correct but might indicate the duration calculation")
                    print("is rounding down very small durations to 0.")
            else:
                print(f"❌ durationMin is missing")
        else:
            print(f"❌ Failed: {resp.text}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/tasks/{task_id}")
        print(f"✅ Cleaned up task")
        
    except Exception as e:
        print(f"❌ Exception: {str(e)}")

if __name__ == "__main__":
    test_notifications()
    test_admin_complete()
