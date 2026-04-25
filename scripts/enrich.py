import json
import os
import pandas as pd
from typing import List, Dict, Any

def check_rules(facility: Dict[str, Any]) -> List[Dict[str, str]]:
    violations = []
    facility_type = facility.get("facility_type", "").upper()
    beds = facility.get("beds")
    
    if beds is not None:
        try:
            beds = int(beds)
        except (ValueError, TypeError):
            beds = -1
            
    services = [s.lower() for s in facility.get("services", [])]
    doctors = facility.get("doctors")
    if doctors is not None:
        try:
            doctors = int(doctors)
        except (ValueError, TypeError):
            doctors = -1

    # 1. PHC bed sanity
    if facility_type == "PHC" and beds > 20:
        violations.append({
            "rule": "PHC_BED_SANITY",
            "description": f"PHC reports {beds} beds, which is far above PHC norms.",
            "citation": "IPHS 2022 / MoHFW PHC norm: PHC with 6 indoor/observation beds"
        })

    # 2. CHC bed sanity
    if facility_type == "CHC" and beds != -1 and beds not in range(25, 120): # Roughly 30, 50, 100
        # Check specifically if it's way off
        if beds < 20 or beds > 150:
            violations.append({
                "rule": "CHC_BED_SANITY",
                "description": f"CHC reports {beds} beds, typically they have 30, 50, or 100 beds.",
                "citation": "IPHS 2022 / MoHFW CHC norm"
            })
            
    # 3. SDH/DH bed sanity
    if facility_type == "SDH" and beds != -1 and (beds < 20 or beds > 150):
        violations.append({
            "rule": "SDH_BED_SANITY",
            "description": f"SDH reports {beds} beds. SDH should roughly be 31-100 beds.",
            "citation": "IPHS 2022 norms"
        })
    elif facility_type == "DISTRICT HOSPITAL" and beds != -1 and (beds < 80 or beds > 600):
        violations.append({
            "rule": "DH_BED_SANITY",
            "description": f"District Hospital reports {beds} beds. Normally 101-500 beds.",
            "citation": "IPHS 2022 norms"
        })

    # 4. Surgery without anesthesia
    has_surgery = any("surgery" in s or "c-section" in s or "operation" in s for s in services)
    
    specialties = [s.lower() for s in facility.get("specialties", [])]
    staff = facility.get("staff_details", [])
    staff_specialties = [s.get("specialty", "").lower() for s in staff if isinstance(s, dict)]
    
    has_anesthesia = any("anesthes" in s for s in specialties + staff_specialties + services)
    
    if has_surgery and not has_anesthesia:
        violations.append({
            "rule": "SURGERY_WITHOUT_ANESTHESIA",
            "description": "Services include surgery/operation theatre, but no mention of anesthesiologist/anesthesia.",
            "citation": "Basic surgical safety norms"
        })

    # 5. Emergency 24/7 with too little staff
    has_emergency = facility.get("emergency_available") is True or any("emergency" in s or "24x7" in s or "24/7" in s for s in services)
    if has_emergency and doctors is not None and doctors != -1 and doctors <= 1 and not staff:
        violations.append({
            "rule": "EMERGENCY_UNDERSTAFFED",
            "description": f"Emergency/24x7 claimed but only {doctors} doctors and no detailed staff listed.",
            "citation": "24/7 facilities require minimum shift staffing"
        })

    # 6. Delivery point without newborn/labour-room signals
    has_delivery = any("deliver" in s or "matern" in s or "labour" in s for s in services)
    equipment = [e.lower() for e in facility.get("equipment", [])]
    has_newborn = any("newborn" in s or "labour room" in s or "nbcc" in s or "sncu" in s for s in services + equipment)

    if has_delivery and not has_newborn:
        violations.append({
            "rule": "DELIVERY_WITHOUT_NEWBORN_CARE",
            "description": "Delivery/maternity services claimed, but no evidence of newborn care or labour room equipment.",
            "citation": "Maternal and newborn care norms"
        })

    return violations

def calculate_trust(facility: Dict[str, Any], violations: List[Dict[str, str]]) -> float:
    # Basic trust calculation
    trust = 1.0
    if facility.get("extraction_confidence") == "low":
        trust -= 0.3
    elif facility.get("extraction_confidence") == "medium":
        trust -= 0.1
        
    unsupported = len(facility.get("unsupported_claims", []))
    trust -= (unsupported * 0.1)
    
    trust -= (len(violations) * 0.15)
    
    return max(0.0, min(1.0, trust))

def add_peer_comparisons(facilities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not facilities:
        return facilities
        
    df = pd.DataFrame(facilities)
    
    # We need to make sure numeric columns are numeric
    df['beds_numeric'] = pd.to_numeric(df['beds'], errors='coerce')
    df['doctors_numeric'] = pd.to_numeric(df['doctors'], errors='coerce')
    
    for idx, row in df.iterrows():
        flags = []
        percentile = 50.0
        
        fac_type = row.get('facility_type')
        state = row.get('state')
        beds = row.get('beds_numeric')
        
        if pd.notna(fac_type) and pd.notna(state) and pd.notna(beds):
            # Find peers (same state, same type)
            peers = df[(df['facility_type'] == fac_type) & (df['state'] == state)]
            if len(peers) > 2:
                # Compare beds
                beds_series = peers['beds_numeric'].dropna()
                if len(beds_series) > 0:
                    pct = (beds_series < beds).mean() * 100
                    percentile = pct
                    if pct > 90:
                        flags.append(f"Beds ({beds}) are unusually high compared with other {fac_type}s in {state} (>{pct:.0f}th percentile).")
                    elif pct < 10:
                        flags.append(f"Beds ({beds}) are unusually low compared with other {fac_type}s in {state} (<{pct:.0f}th percentile).")
        
        # We can apply same logic for doctors if we want
        
        # Update the original dict
        facilities[idx]['peer_anomaly_percentile'] = float(percentile)
        facilities[idx]['peer_anomaly_flags'] = flags
        
    return facilities

def main():
    input_path = "data/extracted.json"
    output_path = "data/facilities_enriched.json"
    
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found. Please run extraction first.")
        return
        
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    enriched_data = []
    for item in data:
        violations = check_rules(item)
        item['rule_violations'] = violations
        item['trust_min'] = calculate_trust(item, violations)
        enriched_data.append(item)
        
    # Add peer comparisons
    enriched_data = add_peer_comparisons(enriched_data)
    
    # Ensure data directory exists for output (should exist if input exists, but just in case)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(enriched_data, f, indent=2)
        
    print(f"Successfully enriched {len(enriched_data)} facilities. Saved to {output_path}.")

if __name__ == "__main__":
    main()
