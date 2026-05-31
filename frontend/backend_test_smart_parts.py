#!/usr/bin/env python3
"""
Smart Parts Compatibility System - Backend Test Suite
Tests 3 NEW endpoints with 12 comprehensive test cases
"""

import requests
import json
import sys
from urllib.parse import urlencode

# Base URL from .env
BASE_URL = "https://isp-noc-hub.preview.emergentagent.com/api"

def print_test(num, desc):
    print(f"\n{'='*80}")
    print(f"TEST {num}: {desc}")
    print('='*80)

def print_pass(msg):
    print(f"✅ PASS: {msg}")

def print_fail(msg):
    print(f"❌ FAIL: {msg}")

def print_info(msg):
    print(f"ℹ️  INFO: {msg}")

# Store created product IDs for cleanup
created_product_ids = []

def test_1_create_product_with_new_fields():
    """Test 1: Create a product with new fields (compatibleDevices, productType, origin, etc.)"""
    print_test(1, "Create product with new fields")
    
    product_data = {
        "name": "كفر iPhone 14 Pro Max جلدي",
        "sku": "COVER-IP14PM-001",
        "barcode": "0123456789",
        "category": "accessories",
        "productType": "cover",
        "origin": "original",
        "brand": "Apple",
        "model": "iPhone 14 Pro Max",
        "color": "أسود",
        "compatibleDevices": ["iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 13 Pro Max", "iPhone 15 Pro"],
        "branch": "بغداد",
        "warehouse": "الرئيسي",
        "shelf": "A-12",
        "cabinet": "C",
        "floor": "2",
        "price": 50000,
        "cost": 25000,
        "stock": 15,
        "lowStockAlert": 3,
        "image": "🛡️"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/products", json=product_data, timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 201:
            data = response.json()
            print_info(f"Response: {json.dumps(data, ensure_ascii=False, indent=2)}")
            
            # Verify all fields preserved
            if data.get('compatibleDevices') == product_data['compatibleDevices']:
                print_pass("compatibleDevices array preserved correctly")
            else:
                print_fail(f"compatibleDevices mismatch: {data.get('compatibleDevices')}")
                
            if data.get('productType') == product_data['productType']:
                print_pass("productType preserved correctly")
            else:
                print_fail(f"productType mismatch: {data.get('productType')}")
                
            if data.get('origin') == product_data['origin']:
                print_pass("origin preserved correctly")
            else:
                print_fail(f"origin mismatch: {data.get('origin')}")
                
            if data.get('branch') == product_data['branch']:
                print_pass("Location fields (branch) preserved correctly")
            else:
                print_fail(f"branch mismatch: {data.get('branch')}")
            
            # Store product ID for later tests
            if 'id' in data:
                created_product_ids.append(data['id'])
                print_pass(f"Product created with ID: {data['id']}")
                return data['id']
            else:
                print_fail("No ID in response")
                return None
        else:
            print_fail(f"Expected 201, got {response.status_code}: {response.text}")
            return None
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        return None

def test_2_smart_search_exact_device_match(product_id):
    """Test 2: Smart search exact device match"""
    print_test(2, "Smart search exact device match")
    
    params = {
        'q': 'كفر',
        'device': 'iPhone 14 Pro Max'
    }
    
    try:
        response = requests.get(f"{BASE_URL}/products/search", params=params, timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_info(f"Response keys: {data.keys()}")
            print_info(f"Exact matches: {len(data.get('exact', []))}")
            print_info(f"Compatible matches: {len(data.get('compatible', []))}")
            print_info(f"Alternatives: {len(data.get('alternatives', []))}")
            
            exact = data.get('exact', [])
            if len(exact) > 0:
                print_pass(f"Found {len(exact)} exact matches")
                
                # Check if our product is in exact matches
                found = False
                for p in exact:
                    if p.get('id') == product_id:
                        found = True
                        if 'iPhone 14 Pro Max' in p.get('compatibleDevices', []):
                            print_pass("Product has 'iPhone 14 Pro Max' in compatibleDevices")
                        else:
                            print_fail(f"Product compatibleDevices: {p.get('compatibleDevices')}")
                        break
                
                if found:
                    print_pass("Our test product found in exact matches")
                else:
                    print_fail("Our test product NOT found in exact matches")
            else:
                print_fail("No exact matches found")
        else:
            print_fail(f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_fail(f"Exception: {str(e)}")

def test_3_smart_search_partial_device_match():
    """Test 3: Smart search partial device match"""
    print_test(3, "Smart search partial device match")
    
    params = {
        'device': 'iPhone 13'
    }
    
    try:
        response = requests.get(f"{BASE_URL}/products/search", params=params, timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            exact = data.get('exact', [])
            compatible = data.get('compatible', [])
            
            print_info(f"Exact matches: {len(exact)}")
            print_info(f"Compatible matches: {len(compatible)}")
            
            # Check if our product is in compatible (because "iPhone 13 Pro Max" is in compatibleDevices)
            found_in_compatible = False
            found_in_exact = False
            
            for p in compatible:
                if 'iPhone 13' in str(p.get('compatibleDevices', [])):
                    found_in_compatible = True
                    print_pass(f"Found product with iPhone 13 variant in compatible: {p.get('name')}")
                    break
            
            for p in exact:
                if p.get('model') == 'iPhone 13' or 'iPhone 13' in p.get('compatibleDevices', []):
                    found_in_exact = True
            
            if found_in_compatible:
                print_pass("Partial match working - found iPhone 13 variants in compatible")
            else:
                print_info("No iPhone 13 variants found in compatible (may be in exact if exact match exists)")
            
            if not found_in_exact:
                print_pass("Exact 'iPhone 13' NOT in exact matches (correct - only partial match)")
            else:
                print_info("Found exact 'iPhone 13' match (acceptable if product has exact device)")
        else:
            print_fail(f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_fail(f"Exception: {str(e)}")

def test_4_filter_by_origin():
    """Test 4: Filter by origin='original'"""
    print_test(4, "Filter by origin='original'")
    
    params = {
        'origin': 'original'
    }
    
    try:
        response = requests.get(f"{BASE_URL}/products/search", params=params, timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            all_results = data.get('exact', []) + data.get('compatible', []) + data.get('alternatives', [])
            
            print_info(f"Total results: {len(all_results)}")
            
            if len(all_results) > 0:
                all_original = all(p.get('origin') == 'original' for p in all_results)
                if all_original:
                    print_pass(f"All {len(all_results)} products have origin='original'")
                else:
                    non_original = [p for p in all_results if p.get('origin') != 'original']
                    print_fail(f"Found {len(non_original)} products without origin='original'")
            else:
                print_info("No products with origin='original' found (may be valid if no such products exist)")
        else:
            print_fail(f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_fail(f"Exception: {str(e)}")

def test_5_filter_by_product_type():
    """Test 5: Filter by productType='cover'"""
    print_test(5, "Filter by productType='cover'")
    
    params = {
        'type': 'cover'
    }
    
    try:
        response = requests.get(f"{BASE_URL}/products/search", params=params, timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            all_results = data.get('exact', []) + data.get('compatible', []) + data.get('alternatives', [])
            
            print_info(f"Total results: {len(all_results)}")
            
            if len(all_results) > 0:
                all_cover = all(p.get('productType') == 'cover' for p in all_results)
                if all_cover:
                    print_pass(f"All {len(all_results)} products have productType='cover'")
                else:
                    non_cover = [p for p in all_results if p.get('productType') != 'cover']
                    print_fail(f"Found {len(non_cover)} products without productType='cover'")
            else:
                print_info("No products with productType='cover' found (may be valid if no such products exist)")
        else:
            print_fail(f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_fail(f"Exception: {str(e)}")

def test_6_filter_by_in_stock():
    """Test 6: Filter by inStock=true"""
    print_test(6, "Filter by inStock=true")
    
    params = {
        'inStock': 'true'
    }
    
    try:
        response = requests.get(f"{BASE_URL}/products/search", params=params, timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            all_results = data.get('exact', []) + data.get('compatible', []) + data.get('alternatives', [])
            
            print_info(f"Total results: {len(all_results)}")
            
            if len(all_results) > 0:
                all_in_stock = all(p.get('stock', 0) > 0 for p in all_results)
                if all_in_stock:
                    print_pass(f"All {len(all_results)} products have stock > 0")
                else:
                    out_of_stock = [p for p in all_results if p.get('stock', 0) <= 0]
                    print_fail(f"Found {len(out_of_stock)} products with stock <= 0")
            else:
                print_info("No products in stock found")
        else:
            print_fail(f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_fail(f"Exception: {str(e)}")

def test_7_combined_filters(product_id):
    """Test 7: Combined filters"""
    print_test(7, "Combined filters (q=كفر, type=cover, origin=original, brand=Apple)")
    
    params = {
        'q': 'كفر',
        'type': 'cover',
        'origin': 'original',
        'brand': 'Apple'
    }
    
    try:
        response = requests.get(f"{BASE_URL}/products/search", params=params, timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            exact = data.get('exact', [])
            
            print_info(f"Exact matches: {len(exact)}")
            
            if len(exact) > 0:
                # Check if our product is in results
                found = False
                for p in exact:
                    if p.get('id') == product_id:
                        found = True
                        print_pass("Our test product found in exact matches with all filters applied")
                        
                        # Verify all filters
                        checks = [
                            (p.get('productType') == 'cover', 'productType=cover'),
                            (p.get('origin') == 'original', 'origin=original'),
                            (p.get('brand', '').lower() == 'apple', 'brand=Apple'),
                            ('كفر' in p.get('name', ''), 'name contains كفر')
                        ]
                        
                        for check, desc in checks:
                            if check:
                                print_pass(f"Filter verified: {desc}")
                            else:
                                print_fail(f"Filter failed: {desc}")
                        break
                
                if not found:
                    print_fail("Our test product NOT found in results")
            else:
                print_fail("No exact matches found with combined filters")
        else:
            print_fail(f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_fail(f"Exception: {str(e)}")

def test_8_devices_list_endpoint():
    """Test 8: Devices list endpoint"""
    print_test(8, "Devices list endpoint")
    
    try:
        response = requests.get(f"{BASE_URL}/products/devices", timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if isinstance(data, list):
                print_pass(f"Response is an array with {len(data)} devices")
                
                # Check for our test device
                if 'iPhone 14 Pro Max' in data:
                    print_pass("'iPhone 14 Pro Max' found in devices list")
                else:
                    print_fail("'iPhone 14 Pro Max' NOT found in devices list")
                
                # Check for duplicates
                if len(data) == len(set(data)):
                    print_pass("No duplicates in devices list")
                else:
                    print_fail(f"Found duplicates: {len(data)} total, {len(set(data))} unique")
                
                # Check if sorted
                if data == sorted(data):
                    print_pass("Devices list is sorted")
                else:
                    print_info("Devices list is not sorted (acceptable)")
                
                # Show sample
                print_info(f"Sample devices: {data[:5]}")
            else:
                print_fail(f"Response is not an array: {type(data)}")
        else:
            print_fail(f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_fail(f"Exception: {str(e)}")

def test_9_compatible_products_endpoint(product_id):
    """Test 9: Compatible products endpoint"""
    print_test(9, "Compatible products endpoint")
    
    # First, create a second cover with overlapping compatible devices
    print_info("Creating second cover with overlapping devices...")
    second_product_data = {
        "name": "كفر iPhone 14 Pro سيليكون",
        "sku": "COVER-IP14P-002",
        "barcode": "0123456790",
        "category": "accessories",
        "productType": "cover",
        "origin": "original",
        "brand": "Apple",
        "model": "iPhone 14 Pro",
        "color": "أزرق",
        "compatibleDevices": ["iPhone 14 Pro", "iPhone 15 Pro Max"],
        "branch": "بغداد",
        "warehouse": "الرئيسي",
        "shelf": "A-13",
        "cabinet": "C",
        "floor": "2",
        "price": 45000,
        "cost": 22000,
        "stock": 20,
        "lowStockAlert": 3,
        "image": "🛡️"
    }
    
    try:
        create_response = requests.post(f"{BASE_URL}/products", json=second_product_data, timeout=10)
        if create_response.status_code == 201:
            second_product = create_response.json()
            second_product_id = second_product.get('id')
            created_product_ids.append(second_product_id)
            print_pass(f"Second product created with ID: {second_product_id}")
        else:
            print_fail(f"Failed to create second product: {create_response.status_code}")
            return
        
        # Now test the compatible endpoint
        response = requests.get(f"{BASE_URL}/products/{product_id}/compatible", timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'target' in data and 'compatible' in data:
                print_pass("Response has 'target' and 'compatible' fields")
                
                target = data['target']
                compatible = data['compatible']
                
                print_info(f"Target product: {target.get('name')}")
                print_info(f"Compatible products: {len(compatible)}")
                
                # Check if second product is in compatible list
                found = False
                for p in compatible:
                    if p.get('id') == second_product_id:
                        found = True
                        print_pass(f"Second product found in compatible list: {p.get('name')}")
                        
                        # Verify they share a device
                        target_devices = set(target.get('compatibleDevices', []))
                        compat_devices = set(p.get('compatibleDevices', []))
                        shared = target_devices & compat_devices
                        
                        if shared:
                            print_pass(f"Shared devices: {shared}")
                        else:
                            print_fail("No shared devices found")
                        break
                
                if not found:
                    print_fail("Second product NOT found in compatible list")
            else:
                print_fail(f"Response missing required fields: {data.keys()}")
        else:
            print_fail(f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_fail(f"Exception: {str(e)}")

def test_10_empty_search():
    """Test 10: Empty search (no params)"""
    print_test(10, "Empty search (no params)")
    
    try:
        response = requests.get(f"{BASE_URL}/products/search", timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            exact = data.get('exact', [])
            total = data.get('total', 0)
            
            print_info(f"Exact matches: {len(exact)}")
            print_info(f"Total: {total}")
            
            if len(exact) > 0:
                print_pass(f"Returns all products in 'exact' array ({len(exact)} products)")
            else:
                print_info("No products returned (may be valid if database is empty)")
            
            # Verify structure
            if 'exact' in data and 'compatible' in data and 'alternatives' in data and 'total' in data:
                print_pass("Response has all required fields")
            else:
                print_fail(f"Response missing fields: {data.keys()}")
        else:
            print_fail(f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_fail(f"Exception: {str(e)}")

def test_11_text_search_multiple_fields():
    """Test 11: Text search across multiple fields"""
    print_test(11, "Text search across multiple fields (q=apple)")
    
    params = {
        'q': 'apple'
    }
    
    try:
        response = requests.get(f"{BASE_URL}/products/search", params=params, timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            all_results = data.get('exact', []) + data.get('compatible', []) + data.get('alternatives', [])
            
            print_info(f"Total results: {len(all_results)}")
            
            if len(all_results) > 0:
                # Check if results contain 'apple' in brand or other fields
                apple_products = []
                for p in all_results:
                    if 'apple' in p.get('brand', '').lower():
                        apple_products.append(p)
                
                if len(apple_products) > 0:
                    print_pass(f"Found {len(apple_products)} products with brand='Apple' (case-insensitive)")
                else:
                    print_info("No products with brand='Apple' found, but search returned results (may match other fields)")
                
                # Show sample
                print_info(f"Sample result: {all_results[0].get('name')} (brand: {all_results[0].get('brand')})")
            else:
                print_info("No results found for 'apple'")
        else:
            print_fail(f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_fail(f"Exception: {str(e)}")

def test_12_price_range_filter():
    """Test 12: Price range filter"""
    print_test(12, "Price range filter (minPrice=40000, maxPrice=60000)")
    
    params = {
        'minPrice': '40000',
        'maxPrice': '60000'
    }
    
    try:
        response = requests.get(f"{BASE_URL}/products/search", params=params, timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            all_results = data.get('exact', []) + data.get('compatible', []) + data.get('alternatives', [])
            
            print_info(f"Total results: {len(all_results)}")
            
            if len(all_results) > 0:
                all_in_range = all(40000 <= p.get('price', 0) <= 60000 for p in all_results)
                if all_in_range:
                    print_pass(f"All {len(all_results)} products have price between 40K and 60K")
                    
                    # Show sample prices
                    prices = [p.get('price') for p in all_results[:3]]
                    print_info(f"Sample prices: {prices}")
                else:
                    out_of_range = [p for p in all_results if not (40000 <= p.get('price', 0) <= 60000)]
                    print_fail(f"Found {len(out_of_range)} products outside price range")
            else:
                print_info("No products in price range 40K-60K found")
        else:
            print_fail(f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_fail(f"Exception: {str(e)}")

def cleanup():
    """Clean up created test products"""
    print(f"\n{'='*80}")
    print("CLEANUP: Deleting test products")
    print('='*80)
    
    for product_id in created_product_ids:
        try:
            response = requests.delete(f"{BASE_URL}/products/{product_id}", timeout=10)
            if response.status_code == 200:
                print_pass(f"Deleted product {product_id}")
            else:
                print_fail(f"Failed to delete product {product_id}: {response.status_code}")
        except Exception as e:
            print_fail(f"Exception deleting product {product_id}: {str(e)}")

def main():
    print("\n" + "="*80)
    print("SMART PARTS COMPATIBILITY SYSTEM - BACKEND TEST SUITE")
    print("Testing 3 NEW endpoints with 12 comprehensive test cases")
    print("="*80)
    
    # Run all tests
    product_id = test_1_create_product_with_new_fields()
    
    if product_id:
        test_2_smart_search_exact_device_match(product_id)
        test_3_smart_search_partial_device_match()
        test_4_filter_by_origin()
        test_5_filter_by_product_type()
        test_6_filter_by_in_stock()
        test_7_combined_filters(product_id)
        test_8_devices_list_endpoint()
        test_9_compatible_products_endpoint(product_id)
        test_10_empty_search()
        test_11_text_search_multiple_fields()
        test_12_price_range_filter()
    else:
        print_fail("Test 1 failed - cannot continue with remaining tests")
    
    # Cleanup
    cleanup()
    
    print("\n" + "="*80)
    print("TEST SUITE COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
