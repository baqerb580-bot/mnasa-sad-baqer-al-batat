#!/usr/bin/env python3
"""
Backend Test Script for Employee Self-Task Creation
Tests the POST /api/employees/:id/tasks/create endpoint
"""

import requests
import json
from datetime import datetime, timedelta

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

def get_date_str(days_offset=0):
    """Get date string in YYYY-MM-DD format"""
    return (datetime.now() + timedelta(days=days_offset)).strftime('%Y-%m-%d')

def main():
    print("\n" + "="*80)
    print("EMPLOYEE SELF-TASK CREATION ENDPOINT TESTING")
    print("="*80)
    
    # Test 1: Get an existing employee ID
    log_test(1, "Get existing employee (username='amer' or similar)")
    try:
        response = requests.get(f"{BASE_URL}/employees", headers=HEADERS)
        if response.status_code != 200:
            log_result(False, f"Failed to get employees: {response.status_code}")
            return
        
        employees = response.json()
        if not employees or len(employees) == 0:
            log_result(False, "No employees found in database")
            return
        
        # Try to find employee with username 'amer' or just use the first one
        test_employee = None
        for emp in employees:
            if emp.get('username') == 'amer':
                test_employee = emp
                break
        
        if not test_employee:
            test_employee = employees[0]
        
        employee_id = test_employee['id']
        employee_name = test_employee['name']
        log_result(True, f"Found employee: {employee_name} (ID: {employee_id})")
        
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
        return
    
    # Test 2: Success case - Create self-task with valid data
    log_test(2, "Success case - POST with valid body")
    try:
        payload = {
            "title": "صيانة جهاز اختبار",
            "description": "اختبار إنشاء مهمة شخصية",
            "priority": "high",
            "dueDate": "2026-12-31"
        }
        
        response = requests.post(
            f"{BASE_URL}/employees/{employee_id}/tasks/create",
            json=payload,
            headers=HEADERS
        )
        
        if response.status_code != 201:
            log_result(False, f"Expected 201, got {response.status_code}: {response.text}")
        else:
            task = response.json()
            
            # Verify all required fields
            checks = []
            checks.append(('id exists', 'id' in task and task['id']))
            checks.append(('title correct', task.get('title') == "صيانة جهاز اختبار"))
            checks.append(('taskType correct', task.get('taskType') == "self_created"))
            checks.append(('assignedTo correct', task.get('assignedTo') == employee_id))
            checks.append(('assignedToName correct', task.get('assignedToName') == employee_name))
            checks.append(('createdByEmp correct', task.get('createdByEmp') == True))
            checks.append(('createdByEmpId correct', task.get('createdByEmpId') == employee_id))
            checks.append(('status correct', task.get('status') == "in_progress"))
            checks.append(('acceptedAt set', 'acceptedAt' in task and task['acceptedAt']))
            checks.append(('startTime set', 'startTime' in task and task['startTime']))
            checks.append(('priority correct', task.get('priority') == "high"))
            checks.append(('dueDate correct', task.get('dueDate') == "2026-12-31"))
            
            all_passed = all(check[1] for check in checks)
            
            if all_passed:
                log_result(True, "Task created with all correct fields")
                created_task_id = task['id']
                print(f"   Task ID: {created_task_id}")
                print(f"   Title: {task['title']}")
                print(f"   Status: {task['status']}")
                print(f"   TaskType: {task['taskType']}")
            else:
                failed_checks = [check[0] for check in checks if not check[1]]
                log_result(False, f"Field validation failed: {', '.join(failed_checks)}")
                print(f"   Response: {json.dumps(task, indent=2, ensure_ascii=False)}")
                return
            
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
        return
    
    # Test 3: Validation - missing title
    log_test(3, "Validation: missing title")
    try:
        payload = {
            "description": "no title"
        }
        
        response = requests.post(
            f"{BASE_URL}/employees/{employee_id}/tasks/create",
            json=payload,
            headers=HEADERS
        )
        
        if response.status_code != 400:
            log_result(False, f"Expected 400, got {response.status_code}")
        else:
            error_data = response.json()
            error_msg = error_data.get('error', '')
            if "عنوان المهمة مطلوب" in error_msg:
                log_result(True, f"Correct Arabic error: {error_msg}")
            else:
                log_result(False, f"Wrong error message: {error_msg}")
                
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
    
    # Test 4: Validation - invalid employee ID
    log_test(4, "Validation: invalid employee ID")
    try:
        payload = {
            "title": "x"
        }
        
        response = requests.post(
            f"{BASE_URL}/employees/non-existent-id-xyz/tasks/create",
            json=payload,
            headers=HEADERS
        )
        
        if response.status_code != 404:
            log_result(False, f"Expected 404, got {response.status_code}")
        else:
            error_data = response.json()
            error_msg = error_data.get('error', '')
            if "الموظف غير موجود" in error_msg:
                log_result(True, f"Correct Arabic error: {error_msg}")
            else:
                log_result(False, f"Wrong error message: {error_msg}")
                
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
    
    # Test 5: Side effects - verify task appears in employee's task list
    log_test(5, "Side effects: Task appears in GET /api/employees/:id/tasks")
    try:
        response = requests.get(
            f"{BASE_URL}/employees/{employee_id}/tasks",
            headers=HEADERS
        )
        
        if response.status_code != 200:
            log_result(False, f"Failed to get employee tasks: {response.status_code}")
        else:
            tasks = response.json()
            found_task = None
            for task in tasks:
                if task.get('id') == created_task_id:
                    found_task = task
                    break
            
            if found_task:
                log_result(True, f"Task found in employee's task list (total tasks: {len(tasks)})")
                print(f"   Task title: {found_task['title']}")
                print(f"   Task status: {found_task['status']}")
            else:
                log_result(False, f"Task not found in employee's task list (searched {len(tasks)} tasks)")
                
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
    
    # Test 6: Side effects - verify activity log entry
    log_test(6, "Side effects: Activity log entry created")
    try:
        response = requests.get(f"{BASE_URL}/activity-logs", headers=HEADERS)
        
        if response.status_code != 200:
            log_result(False, f"Failed to get activity logs: {response.status_code}")
        else:
            logs = response.json()
            found_log = None
            for log in logs:
                if (log.get('action') == 'self_task_created' and 
                    log.get('entity') == 'tasks' and 
                    log.get('entityId') == created_task_id):
                    found_log = log
                    break
            
            if found_log:
                log_result(True, f"Activity log entry found")
                print(f"   Action: {found_log['action']}")
                print(f"   User: {found_log['user']}")
                print(f"   Details: {found_log.get('details', '')}")
            else:
                log_result(False, "Activity log entry not found")
                
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
    
    # Test 7: Side effects - verify manager notification
    log_test(7, "Side effects: Manager notification created")
    try:
        response = requests.get(f"{BASE_URL}/notifications/admin", headers=HEADERS)
        
        if response.status_code != 200:
            log_result(False, f"Failed to get admin notifications: {response.status_code}")
        else:
            notifications = response.json()
            found_notification = None
            for notif in notifications:
                if (notif.get('type') == 'task_self_created' and 
                    employee_name in notif.get('title', '')):
                    found_notification = notif
                    break
            
            if found_notification:
                log_result(True, f"Manager notification found")
                print(f"   Type: {found_notification['type']}")
                print(f"   Title: {found_notification['title']}")
                print(f"   Message: {found_notification.get('message', '')[:100]}...")
                
                # Verify task title is in message
                if "صيانة جهاز اختبار" in found_notification.get('message', ''):
                    print(f"   ✓ Task title found in notification message")
                else:
                    print(f"   ⚠ Task title NOT found in notification message")
            else:
                log_result(False, "Manager notification not found")
                print(f"   Total notifications: {len(notifications)}")
                
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
    
    # Test 8: Default values - POST with only title
    log_test(8, "Default values: POST with only title")
    try:
        payload = {
            "title": "تجربة افتراضية"
        }
        
        response = requests.post(
            f"{BASE_URL}/employees/{employee_id}/tasks/create",
            json=payload,
            headers=HEADERS
        )
        
        if response.status_code != 201:
            log_result(False, f"Expected 201, got {response.status_code}: {response.text}")
        else:
            task = response.json()
            
            # Verify default values
            checks = []
            checks.append(('priority defaults to medium', task.get('priority') == 'medium'))
            checks.append(('description defaults to empty', task.get('description') == ''))
            checks.append(('attachments defaults to empty array', task.get('attachments') == []))
            checks.append(('status is in_progress', task.get('status') == 'in_progress'))
            
            all_passed = all(check[1] for check in checks)
            
            if all_passed:
                log_result(True, "All default values correct")
                print(f"   Priority: {task['priority']}")
                print(f"   Description: '{task['description']}'")
                print(f"   Attachments: {task['attachments']}")
                print(f"   Status: {task['status']}")
            else:
                failed_checks = [check[0] for check in checks if not check[1]]
                log_result(False, f"Default value validation failed: {', '.join(failed_checks)}")
                print(f"   Response: {json.dumps(task, indent=2, ensure_ascii=False)}")
                
    except Exception as e:
        log_result(False, f"Exception: {str(e)}")
    
    print("\n" + "="*80)
    print("TESTING COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
