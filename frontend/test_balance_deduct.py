#!/usr/bin/env python3
"""
Test auto-deduct balance on activation
"""

import requests
import json

BASE_URL = "https://isp-noc-hub.preview.emergentagent.com/api"

print("Testing auto-deduct balance on activation...")

# Get balance accounts
r = requests.get(f"{BASE_URL}/balance/accounts")
if r.status_code == 200:
    accounts = r.json()
    fast_account = next((a for a in accounts if a['key'] == 'fast'), None)
    
    if fast_account:
        print(f"✅ Fast account found: {fast_account['name']}")
        print(f"   Current balance: {fast_account['balance']}")
        
        # Get a subscriber and agent
        r_subs = requests.get(f"{BASE_URL}/subscribers")
        r_agents = requests.get(f"{BASE_URL}/agents")
        r_pkgs = requests.get(f"{BASE_URL}/packages")
        
        if r_subs.status_code == 200 and r_agents.status_code == 200 and r_pkgs.status_code == 200:
            subscribers = r_subs.json()
            agents = r_agents.json()
            packages = r_pkgs.json()
            
            if subscribers and agents and packages:
                test_sub = subscribers[0]
                test_agent = agents[0]
                test_pkg = packages[0]
                
                balance_before = fast_account['balance']
                
                # Activate with fastpay payment method
                print(f"\nActivating subscriber with paymentMethod='fastpay', amount=25000")
                r = requests.post(f"{BASE_URL}/subscribers/{test_sub['id']}/activate", json={
                    'packageId': test_pkg['id'],
                    'amount': 25000,
                    'paymentMethod': 'fastpay',
                    'durationMonths': 1,
                    'agentId': test_agent['id']
                })
                
                if r.status_code in [200, 201]:
                    print(f"✅ Activation successful")
                    
                    # Check balance after
                    r = requests.get(f"{BASE_URL}/balance/accounts")
                    if r.status_code == 200:
                        accounts_after = r.json()
                        fast_account_after = next((a for a in accounts_after if a['key'] == 'fast'), None)
                        
                        if fast_account_after:
                            balance_after = fast_account_after['balance']
                            print(f"\nBalance before: {balance_before}")
                            print(f"Balance after: {balance_after}")
                            print(f"Difference: {balance_before - balance_after}")
                            
                            if balance_before - balance_after == 25000:
                                print(f"✅ AUTO-DEDUCT VERIFIED: Balance decreased by exactly 25000")
                            else:
                                print(f"⚠️  Balance change: {balance_before - balance_after} (expected 25000)")
                        else:
                            print(f"❌ Fast account not found after activation")
                    else:
                        print(f"❌ Could not fetch balance accounts after activation")
                else:
                    print(f"❌ Activation failed: {r.status_code}")
            else:
                print(f"❌ Missing test data")
        else:
            print(f"❌ Could not fetch test data")
    else:
        print(f"❌ Fast account not found")
else:
    print(f"❌ Could not fetch balance accounts: {r.status_code}")
