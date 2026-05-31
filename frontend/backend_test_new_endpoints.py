#!/usr/bin/env python3
"""
Backend API Test Suite for NEW ISP ERP Endpoints
Tests: Packages, Agents, Networks, Activations, WhatsApp, Activity Logs, Subscriber Activation Flow
"""

import requests
import json
import sys
import time

BASE_URL = "https://isp-noc-hub.preview.emergentagent.com/api"

def print_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} - {name}")
    if details:
        print(f"   {details}")
    return passed

def test_packages_crud():
    """Test Packages CRUD operations"""
    print("\n=== Testing Packages CRUD ===")
    all_passed = True
    
    # GET packages (should have 5 seeded)
    try:
        resp = requests.get(f"{BASE_URL}/packages", timeout=10)
        if resp.status_code != 200:
            all_passed = print_test("GET packages", False, f"Status: {resp.status_code}") and all_passed
        else:
            packages = resp.json()
            if not isinstance(packages, list):
                all_passed = print_test("GET packages", False, "Response is not a list") and all_passed
            elif len(packages) < 5:
                all_passed = print_test("GET packages", False, f"Expected at least 5 packages, got {len(packages)}") and all_passed
            else:
                all_passed = print_test("GET packages", True, f"Found {len(packages)} packages") and all_passed
    except Exception as e:
        all_passed = print_test("GET packages", False, f"Exception: {str(e)}") and all_passed
    
    # POST new package
    new_package = {
        "name": "باقة تجريبية 75",
        "speed": "75 Mbps",
        "monthlyFee": 42000,
        "durationDays": 30,
        "profitShare": 23,
        "active": True
    }
    created_id = None
    try:
        resp = requests.post(f"{BASE_URL}/packages", json=new_package, timeout=10)
        if resp.status_code != 201:
            all_passed = print_test("POST package", False, f"Status: {resp.status_code}") and all_passed
        else:
            created = resp.json()
            if 'id' not in created:
                all_passed = print_test("POST package", False, "No ID in response") and all_passed
            else:
                created_id = created['id']
                all_passed = print_test("POST package", True, f"Created package ID: {created_id}") and all_passed
    except Exception as e:
        all_passed = print_test("POST package", False, f"Exception: {str(e)}") and all_passed
    
    # PUT update package
    if created_id:
        try:
            update_data = {"monthlyFee": 45000, "profitShare": 25}
            resp = requests.put(f"{BASE_URL}/packages/{created_id}", json=update_data, timeout=10)
            if resp.status_code != 200:
                all_passed = print_test("PUT package", False, f"Status: {resp.status_code}") and all_passed
            else:
                updated = resp.json()
                if updated.get('monthlyFee') != 45000:
                    all_passed = print_test("PUT package", False, f"Fee not updated: {updated.get('monthlyFee')}") and all_passed
                else:
                    all_passed = print_test("PUT package", True, f"Updated fee to {updated['monthlyFee']}") and all_passed
        except Exception as e:
            all_passed = print_test("PUT package", False, f"Exception: {str(e)}") and all_passed
    
    # DELETE package
    if created_id:
        try:
            resp = requests.delete(f"{BASE_URL}/packages/{created_id}", timeout=10)
            if resp.status_code != 200:
                all_passed = print_test("DELETE package", False, f"Status: {resp.status_code}") and all_passed
            else:
                all_passed = print_test("DELETE package", True, "Package deleted successfully") and all_passed
        except Exception as e:
            all_passed = print_test("DELETE package", False, f"Exception: {str(e)}") and all_passed
    
    return all_passed

def test_agents_crud():
    """Test Agents CRUD operations"""
    print("\n=== Testing Agents CRUD ===")
    all_passed = True
    
    # GET agents (should have 3 seeded: karada, mansour, jadriya)
    try:
        resp = requests.get(f"{BASE_URL}/agents", timeout=10)
        if resp.status_code != 200:
            all_passed = print_test("GET agents", False, f"Status: {resp.status_code}") and all_passed
        else:
            agents = resp.json()
            if not isinstance(agents, list):
                all_passed = print_test("GET agents", False, "Response is not a list") and all_passed
            elif len(agents) < 3:
                all_passed = print_test("GET agents", False, f"Expected at least 3 agents, got {len(agents)}") and all_passed
            else:
                usernames = [a.get('username') for a in agents]
                expected = ['karada', 'mansour', 'jadriya']
                if not all(u in usernames for u in expected):
                    all_passed = print_test("GET agents", False, f"Missing expected agents. Found: {usernames}") and all_passed
                else:
                    all_passed = print_test("GET agents", True, f"Found {len(agents)} agents: {usernames}") and all_passed
    except Exception as e:
        all_passed = print_test("GET agents", False, f"Exception: {str(e)}") and all_passed
    
    # POST new agent
    new_agent = {
        "name": "وكيل الزعفرانية",
        "username": "zafaraniya",
        "password": "zafaraniya123",
        "phone": "07904444000",
        "branch": "الزعفرانية",
        "commission": 21,
        "balance": 0,
        "totalActivations": 0,
        "totalProfit": 0,
        "status": "active"
    }
    created_id = None
    try:
        resp = requests.post(f"{BASE_URL}/agents", json=new_agent, timeout=10)
        if resp.status_code != 201:
            all_passed = print_test("POST agent", False, f"Status: {resp.status_code}") and all_passed
        else:
            created = resp.json()
            if 'id' not in created:
                all_passed = print_test("POST agent", False, "No ID in response") and all_passed
            else:
                created_id = created['id']
                all_passed = print_test("POST agent", True, f"Created agent ID: {created_id}") and all_passed
    except Exception as e:
        all_passed = print_test("POST agent", False, f"Exception: {str(e)}") and all_passed
    
    # PUT update agent
    if created_id:
        try:
            update_data = {"commission": 24, "status": "inactive"}
            resp = requests.put(f"{BASE_URL}/agents/{created_id}", json=update_data, timeout=10)
            if resp.status_code != 200:
                all_passed = print_test("PUT agent", False, f"Status: {resp.status_code}") and all_passed
            else:
                updated = resp.json()
                if updated.get('commission') != 24:
                    all_passed = print_test("PUT agent", False, f"Commission not updated: {updated.get('commission')}") and all_passed
                else:
                    all_passed = print_test("PUT agent", True, f"Updated commission to {updated['commission']}%") and all_passed
        except Exception as e:
            all_passed = print_test("PUT agent", False, f"Exception: {str(e)}") and all_passed
    
    # DELETE agent
    if created_id:
        try:
            resp = requests.delete(f"{BASE_URL}/agents/{created_id}", timeout=10)
            if resp.status_code != 200:
                all_passed = print_test("DELETE agent", False, f"Status: {resp.status_code}") and all_passed
            else:
                all_passed = print_test("DELETE agent", True, "Agent deleted successfully") and all_passed
        except Exception as e:
            all_passed = print_test("DELETE agent", False, f"Exception: {str(e)}") and all_passed
    
    return all_passed

def test_networks_crud():
    """Test Networks/FATs CRUD operations"""
    print("\n=== Testing Networks/FATs CRUD ===")
    all_passed = True
    
    # GET networks (should have ~144 seeded)
    try:
        resp = requests.get(f"{BASE_URL}/networks", timeout=10)
        if resp.status_code != 200:
            all_passed = print_test("GET networks", False, f"Status: {resp.status_code}") and all_passed
        else:
            networks = resp.json()
            if not isinstance(networks, list):
                all_passed = print_test("GET networks", False, "Response is not a list") and all_passed
            elif len(networks) < 10:
                all_passed = print_test("GET networks", False, f"Expected many networks, got only {len(networks)}") and all_passed
            else:
                # Check status distribution
                statuses = [n.get('status') for n in networks]
                status_counts = {s: statuses.count(s) for s in set(statuses)}
                all_passed = print_test("GET networks", True, f"Found {len(networks)} networks. Status: {status_counts}") and all_passed
    except Exception as e:
        all_passed = print_test("GET networks", False, f"Exception: {str(e)}") and all_passed
    
    # Get a zone for the new network
    zone_id = None
    zone_name = None
    zone_number = None
    try:
        resp = requests.get(f"{BASE_URL}/zones", timeout=10)
        if resp.status_code == 200:
            zones = resp.json()
            if len(zones) > 0:
                zone_id = zones[0]['id']
                zone_name = zones[0]['name']
                zone_number = zones[0].get('number', 'Z-001')
    except:
        pass
    
    # POST new network
    new_network = {
        "number": "F-99-99",
        "name": "فاتة تجريبية",
        "zoneId": zone_id,
        "zoneName": zone_name or "زون تجريبي",
        "zoneNumber": zone_number or "Z-001",
        "capacity": 32,
        "subscribers": 0,
        "status": "active",
        "lat": 33.31,
        "lng": 44.41,
        "utilization": 25
    }
    created_id = None
    try:
        resp = requests.post(f"{BASE_URL}/networks", json=new_network, timeout=10)
        if resp.status_code != 201:
            all_passed = print_test("POST network", False, f"Status: {resp.status_code}") and all_passed
        else:
            created = resp.json()
            if 'id' not in created:
                all_passed = print_test("POST network", False, "No ID in response") and all_passed
            else:
                created_id = created['id']
                all_passed = print_test("POST network", True, f"Created network ID: {created_id}") and all_passed
    except Exception as e:
        all_passed = print_test("POST network", False, f"Exception: {str(e)}") and all_passed
    
    # PUT update network
    if created_id:
        try:
            update_data = {"status": "weak", "utilization": 85}
            resp = requests.put(f"{BASE_URL}/networks/{created_id}", json=update_data, timeout=10)
            if resp.status_code != 200:
                all_passed = print_test("PUT network", False, f"Status: {resp.status_code}") and all_passed
            else:
                updated = resp.json()
                if updated.get('status') != 'weak':
                    all_passed = print_test("PUT network", False, f"Status not updated: {updated.get('status')}") and all_passed
                else:
                    all_passed = print_test("PUT network", True, f"Updated status to {updated['status']}") and all_passed
        except Exception as e:
            all_passed = print_test("PUT network", False, f"Exception: {str(e)}") and all_passed
    
    # DELETE network
    if created_id:
        try:
            resp = requests.delete(f"{BASE_URL}/networks/{created_id}", timeout=10)
            if resp.status_code != 200:
                all_passed = print_test("DELETE network", False, f"Status: {resp.status_code}") and all_passed
            else:
                all_passed = print_test("DELETE network", True, "Network deleted successfully") and all_passed
        except Exception as e:
            all_passed = print_test("DELETE network", False, f"Exception: {str(e)}") and all_passed
    
    return all_passed

def test_activations_log():
    """Test GET /api/activations"""
    print("\n=== Testing Activations Log ===")
    try:
        resp = requests.get(f"{BASE_URL}/activations", timeout=10)
        if resp.status_code != 200:
            return print_test("GET activations", False, f"Status: {resp.status_code}")
        
        activations = resp.json()
        if not isinstance(activations, list):
            return print_test("GET activations", False, "Response is not a list")
        
        # Check structure if any activations exist
        if len(activations) > 0:
            act = activations[0]
            required_fields = ['id', 'subscriberId', 'subscriberName', 'amount', 'agentProfit', 
                             'companyProfit', 'startDate', 'endDate', 'status']
            missing = [f for f in required_fields if f not in act]
            if missing:
                return print_test("GET activations", False, f"Missing fields: {missing}")
        
        return print_test("GET activations", True, f"Found {len(activations)} activation records")
    except Exception as e:
        return print_test("GET activations", False, f"Exception: {str(e)}")

def test_whatsapp_messages():
    """Test GET /api/whatsapp-messages"""
    print("\n=== Testing WhatsApp Messages ===")
    try:
        resp = requests.get(f"{BASE_URL}/whatsapp-messages", timeout=10)
        if resp.status_code != 200:
            return print_test("GET whatsapp-messages", False, f"Status: {resp.status_code}")
        
        messages = resp.json()
        if not isinstance(messages, list):
            return print_test("GET whatsapp-messages", False, "Response is not a list")
        
        # Check structure if any messages exist
        if len(messages) > 0:
            msg = messages[0]
            required_fields = ['id', 'phone', 'type', 'message', 'status', 'retries']
            missing = [f for f in required_fields if f not in msg]
            if missing:
                return print_test("GET whatsapp-messages", False, f"Missing fields: {missing}")
        
        return print_test("GET whatsapp-messages", True, f"Found {len(messages)} WhatsApp messages")
    except Exception as e:
        return print_test("GET whatsapp-messages", False, f"Exception: {str(e)}")

def test_activity_logs():
    """Test GET /api/activity-logs"""
    print("\n=== Testing Activity Logs ===")
    try:
        resp = requests.get(f"{BASE_URL}/activity-logs", timeout=10)
        if resp.status_code != 200:
            return print_test("GET activity-logs", False, f"Status: {resp.status_code}")
        
        logs = resp.json()
        if not isinstance(logs, list):
            return print_test("GET activity-logs", False, "Response is not a list")
        
        # Check structure if any logs exist
        if len(logs) > 0:
            log = logs[0]
            required_fields = ['id', 'user', 'action', 'entity', 'timestamp']
            missing = [f for f in required_fields if f not in log]
            if missing:
                return print_test("GET activity-logs", False, f"Missing fields: {missing}")
        
        return print_test("GET activity-logs", True, f"Found {len(logs)} activity log entries")
    except Exception as e:
        return print_test("GET activity-logs", False, f"Exception: {str(e)}")

def test_agent_login():
    """Test POST /api/agents/login"""
    print("\n=== Testing Agent Login ===")
    all_passed = True
    
    # Test successful login
    try:
        login_data = {"username": "karada", "password": "karada123"}
        resp = requests.post(f"{BASE_URL}/agents/login", json=login_data, timeout=10)
        if resp.status_code != 200:
            all_passed = print_test("Agent login (valid)", False, f"Status: {resp.status_code}") and all_passed
        else:
            data = resp.json()
            required_fields = ['success', 'agent', 'token']
            missing = [f for f in required_fields if f not in data]
            if missing:
                all_passed = print_test("Agent login (valid)", False, f"Missing fields: {missing}") and all_passed
            elif not data.get('success'):
                all_passed = print_test("Agent login (valid)", False, "success is not true") and all_passed
            elif 'id' not in data.get('agent', {}):
                all_passed = print_test("Agent login (valid)", False, "No agent.id in response") and all_passed
            else:
                all_passed = print_test("Agent login (valid)", True, f"Logged in as {data['agent'].get('name')}") and all_passed
    except Exception as e:
        all_passed = print_test("Agent login (valid)", False, f"Exception: {str(e)}") and all_passed
    
    # Test failed login
    try:
        login_data = {"username": "karada", "password": "wrongpassword"}
        resp = requests.post(f"{BASE_URL}/agents/login", json=login_data, timeout=10)
        if resp.status_code != 401:
            all_passed = print_test("Agent login (invalid)", False, f"Expected 401, got {resp.status_code}") and all_passed
        else:
            all_passed = print_test("Agent login (invalid)", True, "Correctly rejected invalid credentials") and all_passed
    except Exception as e:
        all_passed = print_test("Agent login (invalid)", False, f"Exception: {str(e)}") and all_passed
    
    return all_passed

def test_agent_stats():
    """Test GET /api/agents/:id/stats"""
    print("\n=== Testing Agent Stats ===")
    try:
        # First get an agent
        resp = requests.get(f"{BASE_URL}/agents", timeout=10)
        if resp.status_code != 200:
            return print_test("Agent stats", False, "Cannot get agents list")
        
        agents = resp.json()
        if len(agents) == 0:
            return print_test("Agent stats", False, "No agents available")
        
        agent_id = agents[0]['id']
        
        # Get agent stats
        resp = requests.get(f"{BASE_URL}/agents/{agent_id}/stats", timeout=10)
        if resp.status_code != 200:
            return print_test("Agent stats", False, f"Status: {resp.status_code}")
        
        data = resp.json()
        required_fields = ['agent', 'stats', 'subscribers', 'activations']
        missing = [f for f in required_fields if f not in data]
        if missing:
            return print_test("Agent stats", False, f"Missing fields: {missing}")
        
        # Check stats structure
        stats = data.get('stats', {})
        stats_fields = ['totalSubscribers', 'activeSubscribers', 'totalActivations', 
                       'totalRevenue', 'totalProfit', 'totalDebt', 'expiringSoon']
        missing_stats = [f for f in stats_fields if f not in stats]
        if missing_stats:
            return print_test("Agent stats", False, f"Missing stats fields: {missing_stats}")
        
        return print_test("Agent stats", True, 
                         f"Agent: {data['agent'].get('name')}, Subscribers: {stats['totalSubscribers']}, Activations: {stats['totalActivations']}")
    except Exception as e:
        return print_test("Agent stats", False, f"Exception: {str(e)}")

def test_whatsapp_resend():
    """Test POST /api/whatsapp-messages/:id/resend"""
    print("\n=== Testing WhatsApp Message Resend ===")
    try:
        # First get a message
        resp = requests.get(f"{BASE_URL}/whatsapp-messages", timeout=10)
        if resp.status_code != 200:
            return print_test("WhatsApp resend", False, "Cannot get messages list")
        
        messages = resp.json()
        if len(messages) == 0:
            return print_test("WhatsApp resend", False, "No messages available to resend")
        
        msg_id = messages[0]['id']
        initial_retries = messages[0].get('retries', 0)
        
        # Resend message
        resp = requests.post(f"{BASE_URL}/whatsapp-messages/{msg_id}/resend", timeout=10)
        if resp.status_code != 200:
            return print_test("WhatsApp resend", False, f"Status: {resp.status_code}")
        
        data = resp.json()
        if not data.get('success'):
            return print_test("WhatsApp resend", False, "success is not true")
        
        # Verify retries incremented
        resp = requests.get(f"{BASE_URL}/whatsapp-messages", timeout=10)
        messages_after = resp.json()
        msg_after = next((m for m in messages_after if m['id'] == msg_id), None)
        
        if msg_after:
            if msg_after.get('retries', 0) != initial_retries + 1:
                return print_test("WhatsApp resend", False, 
                                f"Retries not incremented. Expected: {initial_retries + 1}, Got: {msg_after.get('retries')}")
            if msg_after.get('status') != 'queued':
                return print_test("WhatsApp resend", False, 
                                f"Status not set to queued. Got: {msg_after.get('status')}")
        
        return print_test("WhatsApp resend", True, f"Retries incremented to {msg_after.get('retries')}, status: queued")
    except Exception as e:
        return print_test("WhatsApp resend", False, f"Exception: {str(e)}")

def test_subscriber_backfill():
    """Test subscriber backfill verification (username, agentId, networkId, GPS)"""
    print("\n=== Testing Subscriber Backfill Fields ===")
    try:
        resp = requests.get(f"{BASE_URL}/subscribers", timeout=10)
        if resp.status_code != 200:
            return print_test("Subscriber backfill", False, f"Status: {resp.status_code}")
        
        subscribers = resp.json()
        if len(subscribers) == 0:
            return print_test("Subscriber backfill", False, "No subscribers to check")
        
        # Check that all subscribers have the new fields
        required_fields = ['username', 'agentId', 'agentName', 'fatNumber', 'zoneNumber', 
                          'userLat', 'userLng', 'cabinetLat', 'cabinetLng']
        
        missing_counts = {field: 0 for field in required_fields}
        for sub in subscribers:
            for field in required_fields:
                if field not in sub or sub[field] is None:
                    missing_counts[field] += 1
        
        # Check if any fields are missing
        issues = [f"{field}: {count}/{len(subscribers)} missing" 
                 for field, count in missing_counts.items() if count > 0]
        
        if issues:
            return print_test("Subscriber backfill", False, f"Missing fields: {', '.join(issues)}")
        
        # Sample one subscriber to show the data
        sample = subscribers[0]
        return print_test("Subscriber backfill", True, 
                         f"All {len(subscribers)} subscribers have required fields. Sample: username={sample.get('username')}, agent={sample.get('agentName')}, FAT={sample.get('fatNumber')}")
    except Exception as e:
        return print_test("Subscriber backfill", False, f"Exception: {str(e)}")

def test_subscriber_activation_flow():
    """Test POST /api/subscribers/:id/activate - CRITICAL ENDPOINT"""
    print("\n=== Testing Subscriber Activation Flow (CRITICAL) ===")
    all_passed = True
    
    # Get a subscriber
    subscriber_id = None
    subscriber_name = None
    try:
        resp = requests.get(f"{BASE_URL}/subscribers", timeout=10)
        if resp.status_code == 200:
            subs = resp.json()
            if len(subs) > 0:
                subscriber_id = subs[0]['id']
                subscriber_name = subs[0]['name']
    except:
        pass
    
    if not subscriber_id:
        return print_test("Subscriber activation", False, "No subscriber available for activation")
    
    # Get a package
    package_id = None
    try:
        resp = requests.get(f"{BASE_URL}/packages", timeout=10)
        if resp.status_code == 200:
            pkgs = resp.json()
            if len(pkgs) > 0:
                package_id = pkgs[0]['id']
    except:
        pass
    
    # Get an agent
    agent_id = None
    agent_name = None
    try:
        resp = requests.get(f"{BASE_URL}/agents", timeout=10)
        if resp.status_code == 200:
            agents = resp.json()
            if len(agents) > 0:
                agent_id = agents[0]['id']
                agent_name = agents[0]['name']
    except:
        pass
    
    # Get initial agent stats
    initial_activations = 0
    initial_profit = 0
    initial_balance = 0
    if agent_id:
        try:
            resp = requests.get(f"{BASE_URL}/agents/{agent_id}/stats", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                initial_activations = data['stats'].get('totalActivations', 0)
                initial_profit = data['agent'].get('totalProfit', 0)
                initial_balance = data['agent'].get('balance', 0)
        except:
            pass
    
    # Perform activation
    activation_data = {
        "packageId": package_id,
        "speed": "50 Mbps",
        "amount": 50000,
        "paymentMethod": "fastpay",
        "durationMonths": 3,
        "agentId": agent_id,
        "notes": "تفعيل تجريبي من الاختبار الآلي",
        "processedBy": "نظام الاختبار"
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/subscribers/{subscriber_id}/activate", 
                           json=activation_data, timeout=10)
        if resp.status_code != 201:
            all_passed = print_test("Activation POST", False, 
                                  f"Status: {resp.status_code}, Response: {resp.text}") and all_passed
            return all_passed
        
        data = resp.json()
        
        # Verify response structure
        required_fields = ['activation', 'whatsappMessage', 'success']
        missing = [f for f in required_fields if f not in data]
        if missing:
            all_passed = print_test("Activation response", False, f"Missing fields: {missing}") and all_passed
        else:
            all_passed = print_test("Activation response", True, "All required fields present") and all_passed
        
        # Verify activation object
        activation = data.get('activation', {})
        activation_fields = ['id', 'subscriberName', 'amount', 'agentProfit', 'companyProfit', 
                           'endDate', 'speed', 'paymentMethod']
        missing_act = [f for f in activation_fields if f not in activation]
        if missing_act:
            all_passed = print_test("Activation object", False, f"Missing fields: {missing_act}") and all_passed
        else:
            all_passed = print_test("Activation object", True, 
                                  f"Amount: {activation['amount']}, Agent profit: {activation['agentProfit']}, Company profit: {activation['companyProfit']}") and all_passed
        
        # Verify WhatsApp message contains Arabic text and key info
        wa_msg = data.get('whatsappMessage', '')
        if not wa_msg or len(wa_msg) < 50:
            all_passed = print_test("WhatsApp message", False, "Message too short or empty") and all_passed
        elif subscriber_name not in wa_msg:
            all_passed = print_test("WhatsApp message", False, "Subscriber name not in message") and all_passed
        elif '50 Mbps' not in wa_msg:
            all_passed = print_test("WhatsApp message", False, "Speed not in message") and all_passed
        elif '50000' not in wa_msg and '50,000' not in wa_msg:
            all_passed = print_test("WhatsApp message", False, "Amount not in message") and all_passed
        else:
            all_passed = print_test("WhatsApp message", True, 
                                  f"Arabic template generated with subscriber name, speed, amount") and all_passed
        
        # Wait a moment for DB updates
        time.sleep(1)
        
        # Verify subscriber status changed to 'active'
        try:
            resp = requests.get(f"{BASE_URL}/subscribers", timeout=10)
            subs = resp.json()
            sub = next((s for s in subs if s['id'] == subscriber_id), None)
            if sub:
                if sub.get('status') != 'active':
                    all_passed = print_test("Subscriber status", False, 
                                          f"Status not active: {sub.get('status')}") and all_passed
                elif not sub.get('dueDate'):
                    all_passed = print_test("Subscriber dueDate", False, "dueDate not set") and all_passed
                elif not sub.get('lastActivationAt'):
                    all_passed = print_test("Subscriber lastActivationAt", False, "lastActivationAt not set") and all_passed
                else:
                    all_passed = print_test("Subscriber updated", True, 
                                          f"Status: active, dueDate: {sub['dueDate']}") and all_passed
        except Exception as e:
            all_passed = print_test("Subscriber verification", False, f"Exception: {str(e)}") and all_passed
        
        # Verify agent stats updated
        if agent_id:
            try:
                resp = requests.get(f"{BASE_URL}/agents/{agent_id}/stats", timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    new_activations = data['stats'].get('totalActivations', 0)
                    new_profit = data['agent'].get('totalProfit', 0)
                    new_balance = data['agent'].get('balance', 0)
                    
                    if new_activations != initial_activations + 1:
                        all_passed = print_test("Agent totalActivations", False, 
                                              f"Expected {initial_activations + 1}, got {new_activations}") and all_passed
                    else:
                        all_passed = print_test("Agent totalActivations", True, 
                                              f"Incremented from {initial_activations} to {new_activations}") and all_passed
                    
                    expected_profit = initial_profit + activation.get('agentProfit', 0)
                    if new_profit != expected_profit:
                        all_passed = print_test("Agent totalProfit", False, 
                                              f"Expected {expected_profit}, got {new_profit}") and all_passed
                    else:
                        all_passed = print_test("Agent totalProfit", True, 
                                              f"Increased by {activation.get('agentProfit')}") and all_passed
                    
                    expected_balance = initial_balance + activation.get('agentProfit', 0)
                    if new_balance != expected_balance:
                        all_passed = print_test("Agent balance", False, 
                                              f"Expected {expected_balance}, got {new_balance}") and all_passed
                    else:
                        all_passed = print_test("Agent balance", True, 
                                              f"Increased by {activation.get('agentProfit')}") and all_passed
            except Exception as e:
                all_passed = print_test("Agent stats verification", False, f"Exception: {str(e)}") and all_passed
        
        # Verify WhatsApp messages created (2: subscriber + manager)
        try:
            resp = requests.get(f"{BASE_URL}/whatsapp-messages", timeout=10)
            messages = resp.json()
            activation_id = activation.get('id')
            related_msgs = [m for m in messages if m.get('activationId') == activation_id]
            
            if len(related_msgs) < 2:
                all_passed = print_test("WhatsApp messages created", False, 
                                      f"Expected 2 messages, found {len(related_msgs)}") and all_passed
            else:
                types = [m.get('type') for m in related_msgs]
                if 'activation' not in types:
                    all_passed = print_test("WhatsApp messages types", False, 
                                          "Missing 'activation' type message") and all_passed
                elif 'manager_alert' not in types:
                    all_passed = print_test("WhatsApp messages types", False, 
                                          "Missing 'manager_alert' type message") and all_passed
                else:
                    all_passed = print_test("WhatsApp messages created", True, 
                                          f"2 messages created: activation + manager_alert") and all_passed
        except Exception as e:
            all_passed = print_test("WhatsApp messages verification", False, f"Exception: {str(e)}") and all_passed
        
        # Verify activity log created
        try:
            resp = requests.get(f"{BASE_URL}/activity-logs", timeout=10)
            logs = resp.json()
            # Find log for this subscriber
            related_logs = [l for l in logs if l.get('entityId') == subscriber_id and 
                          l.get('action') == 'subscriber_activation']
            
            if len(related_logs) == 0:
                all_passed = print_test("Activity log created", False, "No activity log found") and all_passed
            else:
                all_passed = print_test("Activity log created", True, 
                                      f"Activity log entry created") and all_passed
        except Exception as e:
            all_passed = print_test("Activity log verification", False, f"Exception: {str(e)}") and all_passed
        
        # Verify activation appears in activations list
        try:
            resp = requests.get(f"{BASE_URL}/activations", timeout=10)
            activations = resp.json()
            activation_id = activation.get('id')
            found = any(a.get('id') == activation_id for a in activations)
            
            if not found:
                all_passed = print_test("Activation in list", False, "Activation not found in /api/activations") and all_passed
            else:
                all_passed = print_test("Activation in list", True, "Activation appears in activations list") and all_passed
        except Exception as e:
            all_passed = print_test("Activations list verification", False, f"Exception: {str(e)}") and all_passed
        
    except Exception as e:
        all_passed = print_test("Subscriber activation", False, f"Exception: {str(e)}") and all_passed
    
    return all_passed

def main():
    print("=" * 80)
    print("GHAZLAN ERP - NEW ENDPOINTS TEST SUITE")
    print("Testing: Packages, Agents, Networks, Activations, WhatsApp, Activity Logs")
    print("=" * 80)
    
    results = {}
    
    # Test NEW endpoints
    results['packages'] = test_packages_crud()
    results['agents'] = test_agents_crud()
    results['networks'] = test_networks_crud()
    results['activations_log'] = test_activations_log()
    results['whatsapp_messages'] = test_whatsapp_messages()
    results['activity_logs'] = test_activity_logs()
    results['agent_login'] = test_agent_login()
    results['agent_stats'] = test_agent_stats()
    results['whatsapp_resend'] = test_whatsapp_resend()
    results['subscriber_backfill'] = test_subscriber_backfill()
    
    # CRITICAL: Test activation flow last (after all other endpoints verified)
    results['activation_flow'] = test_subscriber_activation_flow()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    print(f"\nTotal: {passed}/{total} test groups passed")
    
    if passed == total:
        print("\n🎉 ALL NEW ENDPOINTS TESTS PASSED! Backend expansion is fully functional.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. See details above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
