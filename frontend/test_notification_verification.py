#!/usr/bin/env python3
"""
Verify notification fields are updated correctly in database
"""

import requests
import json

BASE_URL = "https://isp-noc-hub.preview.emergentagent.com/api"

def verify_notification_updates():
    """Verify notification fields after click/resolve/reopen operations"""
    print("\n" + "="*80)
    print("VERIFICATION: Notification Field Updates")
    print("="*80)
    
    try:
        # Get notifications
        resp = requests.get(f"{BASE_URL}/notifications/admin")
        if resp.status_code != 200:
            print(f"❌ Failed to get notifications: {resp.status_code}")
            return
        
        notifications = resp.json()
        if len(notifications) == 0:
            print("❌ No notifications found")
            return
        
        # Pick a notification that hasn't been clicked yet
        unclicked = next((n for n in notifications if not n.get('clickedAt')), None)
        if not unclicked:
            print("All notifications already clicked, using first one")
            unclicked = notifications[0]
        
        notif_id = unclicked['id']
        print(f"\n📋 Testing with notification ID: {notif_id}")
        print(f"Initial state: read={unclicked.get('read')}, resolved={unclicked.get('resolved')}")
        
        # Test 1: Click
        print("\n--- Test 1: Click ---")
        resp = requests.post(f"{BASE_URL}/notifications/{notif_id}/click")
        if resp.status_code == 200:
            print("✅ Click endpoint returned 200")
            
            # Verify in database
            resp = requests.get(f"{BASE_URL}/notifications/admin")
            if resp.status_code == 200:
                notifications = resp.json()
                clicked_notif = next((n for n in notifications if n['id'] == notif_id), None)
                
                if clicked_notif:
                    print(f"After click:")
                    print(f"  - read: {clicked_notif.get('read')}")
                    print(f"  - clickedAt: {clicked_notif.get('clickedAt')}")
                    
                    if clicked_notif.get('read') and clicked_notif.get('clickedAt'):
                        print("✅ Notification correctly marked as read with clickedAt timestamp")
                    else:
                        print("❌ Notification NOT properly updated after click")
        else:
            print(f"❌ Click failed: {resp.status_code}")
        
        # Test 2: Resolve
        print("\n--- Test 2: Resolve ---")
        payload = {"note": "تمت المعالجة بنجاح", "resolvedBy": "مدير النظام"}
        resp = requests.post(f"{BASE_URL}/notifications/{notif_id}/resolve", json=payload)
        if resp.status_code == 200:
            print("✅ Resolve endpoint returned 200")
            
            # Verify in database
            resp = requests.get(f"{BASE_URL}/notifications/admin")
            if resp.status_code == 200:
                notifications = resp.json()
                resolved_notif = next((n for n in notifications if n['id'] == notif_id), None)
                
                if resolved_notif:
                    print(f"After resolve:")
                    print(f"  - resolved: {resolved_notif.get('resolved')}")
                    print(f"  - resolvedAt: {resolved_notif.get('resolvedAt')}")
                    print(f"  - resolvedBy: {resolved_notif.get('resolvedBy')}")
                    print(f"  - resolutionNote: {resolved_notif.get('resolutionNote')}")
                    print(f"  - read: {resolved_notif.get('read')}")
                    
                    checks = {
                        'resolved': resolved_notif.get('resolved') == True,
                        'resolvedAt': resolved_notif.get('resolvedAt') is not None,
                        'resolvedBy': resolved_notif.get('resolvedBy') == "مدير النظام",
                        'resolutionNote': resolved_notif.get('resolutionNote') == "تمت المعالجة بنجاح",
                        'read': resolved_notif.get('read') == True
                    }
                    
                    if all(checks.values()):
                        print("✅ All resolve fields correctly updated")
                    else:
                        print(f"❌ Some fields not updated correctly: {checks}")
        else:
            print(f"❌ Resolve failed: {resp.status_code}")
        
        # Test 3: Reopen
        print("\n--- Test 3: Reopen ---")
        resp = requests.post(f"{BASE_URL}/notifications/{notif_id}/reopen")
        if resp.status_code == 200:
            print("✅ Reopen endpoint returned 200")
            
            # Verify in database
            resp = requests.get(f"{BASE_URL}/notifications/admin")
            if resp.status_code == 200:
                notifications = resp.json()
                reopened_notif = next((n for n in notifications if n['id'] == notif_id), None)
                
                if reopened_notif:
                    print(f"After reopen:")
                    print(f"  - resolved: {reopened_notif.get('resolved')}")
                    print(f"  - resolvedAt: {reopened_notif.get('resolvedAt')}")
                    print(f"  - resolvedBy: {reopened_notif.get('resolvedBy')}")
                    
                    checks = {
                        'resolved': reopened_notif.get('resolved') == False,
                        'resolvedAt': reopened_notif.get('resolvedAt') is None,
                        'resolvedBy': reopened_notif.get('resolvedBy') is None
                    }
                    
                    if all(checks.values()):
                        print("✅ All reopen fields correctly reset")
                    else:
                        print(f"❌ Some fields not reset correctly: {checks}")
        else:
            print(f"❌ Reopen failed: {resp.status_code}")
        
        # Test 4: Delete (soft delete)
        print("\n--- Test 4: Delete (Soft Delete) ---")
        resp = requests.delete(f"{BASE_URL}/notifications/{notif_id}")
        if resp.status_code == 200:
            print("✅ Delete endpoint returned 200")
            
            # Note: Soft deleted notifications might be filtered out from the list
            # So we just verify the endpoint returned success
            print("✅ Notification soft deleted (may be filtered from list)")
        else:
            print(f"❌ Delete failed: {resp.status_code}")
        
    except Exception as e:
        print(f"❌ Exception: {str(e)}")

if __name__ == "__main__":
    verify_notification_updates()
