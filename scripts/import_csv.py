import csv
import io
import json
import os
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv
load_dotenv(".env.local")

FACILITY_TYPE_MAP = {
    "clinic": "Clinic",
    "hospital": "Hospital",
    "dentist": "Dentist",
    "doctor": "Doctor",
    "farmacy": "Pharmacy",
    "pharmacy": "Pharmacy",
}


def parse_json_array(val):
    if not val or val in ("null", "[]", ""):
        return []
    try:
        parsed = json.loads(val.replace("'", '"'))
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, ValueError):
        return []


def parse_int(val):
    if not val or val in ("null", ""):
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def parse_float(val):
    if not val or val in ("null", ""):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def check_facility_rules(f_type, specialties, services, doctors, equipment):
    flags = []
    f_type_lower = (f_type or "").lower()
    
    # Signal 1
    if f_type_lower == "clinic":
        if any("cardiacsurgery" in s.lower() or "neurosurgery" in s.lower() for s in specialties):
            flags.append("Clinic claims highly specialized surgery (cardiac/neuro).")
            
    if f_type_lower == "dentist":
        if any("cataract" in s.lower() for s in services + specialties):
            flags.append("Dentist claims cataract surgery.")
            
    if f_type_lower == "pharmacy":
        if any("surgery" in s.lower() or "orthopedic" in s.lower() for s in specialties):
            flags.append("Pharmacy claims surgical/orthopedic specialties.")
            
    # Signal 2
    if len(specialties) >= 15 and doctors is not None and doctors <= 1:
        flags.append(f"Claims {len(specialties)} specialties but lists only {doctors} doctor(s).")
        
    has_surgery = any("surgery" in s.lower() for s in services + specialties)
    if has_surgery and len(equipment) == 0:
        flags.append("Claims surgical capabilities but lists zero equipment.")
        
    return flags


def main():
    csv_path = "data/VF_Hackathon_Dataset_India_Large.xlsx - VF_Hackathon_Dataset_India_Larg.csv"

    with open(csv_path, "rb") as f:
        content = f.read().replace(b"\x00", b"")

    reader = csv.DictReader(io.StringIO(content.decode("utf-8", errors="replace")))
    rows = list(reader)
    print(f"Loaded {len(rows)} rows")

    # PRE-PARSE to compute peer stats
    parsed_records = []
    peer_stats = {}
    
    for r in rows:
        facility_type = FACILITY_TYPE_MAP.get(r.get("facilityTypeId", ""), None)
        services = parse_json_array(r.get("procedure", "[]"))
        capabilities = parse_json_array(r.get("capability", "[]"))
        all_services = services + capabilities
        specialties = parse_json_array(r.get("specialties", "[]"))
        equipment = parse_json_array(r.get("equipment", "[]"))
        doctors = parse_int(r.get("numberDoctors"))
        district = r.get("address_city", "").strip().lower()
        
        parsed_records.append({
            "raw": r,
            "type": facility_type,
            "services": all_services,
            "specialties": specialties,
            "equipment": equipment,
            "doctors": doctors,
            "district": district
        })
        
        if district and facility_type:
            key = (district, facility_type)
            if key not in peer_stats:
                peer_stats[key] = []
            peer_stats[key].append(len(specialties))

    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cur = conn.cursor()

    cur.execute("DELETE FROM facilities")
    conn.commit()
    print("Cleared existing data")

    INSERT_SQL = """INSERT INTO facilities (
        facility_name, facility_type, facility_type_confidence, ownership_type,
        state, district, pincode, lat, lon,
        beds, doctors, services, equipment, specialties,
        emergency_available,
        extraction_confidence, unsupported_claims,
        rule_violations, peer_anomaly_flags,
        raw_notes, data_source
    ) VALUES (
        %(name)s, %(type)s, %(type_conf)s, %(owner)s,
        %(state)s, %(district)s, %(pincode)s, %(lat)s, %(lon)s,
        %(beds)s, %(doctors)s, %(services)s, %(equipment)s, %(specialties)s,
        %(emergency)s,
        %(ext_conf)s, %(unsup)s,
        %(rules)s, %(peer_flags)s,
        %(notes)s, %(source)s
    )"""

    batch = []
    for p in parsed_records:
        r = p["raw"]
        facility_type = p["type"]
        all_services = p["services"]
        specialties = p["specialties"]
        equipment = p["equipment"]
        doctors = p["doctors"]
        district = p["district"]

        description = r.get("description", "") or ""
        if description == "null":
            description = ""

        emergency = any(
            "emergency" in s.lower() or "24" in s.lower() or "trauma" in s.lower()
            for s in all_services + specialties
        )
        
        # Check standard rules
        rule_flags = check_facility_rules(facility_type, specialties, all_services, doctors, equipment)
        
        # Check peer anomalies
        peer_flags = []
        if district and facility_type:
            key = (district, facility_type)
            district_specialty_counts = peer_stats.get(key, [])
            if len(district_specialty_counts) > 2:
                avg_specialties = sum(district_specialty_counts) / len(district_specialty_counts)
                my_count = len(specialties)
                # If claiming far more than average (e.g. > 15 when avg is low)
                if my_count > 10 and my_count > (avg_specialties * 3):
                    peer_flags.append(f"Claims {my_count} specialties, but average {facility_type} in this city claims {avg_specialties:.1f}.")

        batch.append({
            "name": r.get("name", "Unknown"),
            "type": facility_type,
            "type_conf": "high" if facility_type else "low",
            "owner": r.get("operatorTypeId") if r.get("operatorTypeId") != "null" else None,
            "state": r.get("address_stateOrRegion"),
            "district": r.get("address_city"),
            "pincode": r.get("address_zipOrPostcode"),
            "lat": parse_float(r.get("latitude")),
            "lon": parse_float(r.get("longitude")),
            "beds": parse_int(r.get("capacity")),
            "doctors": doctors,
            "services": json.dumps(all_services),
            "equipment": json.dumps(equipment),
            "specialties": json.dumps(specialties),
            "emergency": emergency,
            "ext_conf": "pending",
            "unsup": json.dumps([]),
            "rules": json.dumps(rule_flags),
            "peer_flags": json.dumps(peer_flags),
            "notes": description,
            "source": "VF_Hackathon_Dataset_India",
        })

    print(f"Inserting {len(batch)} rows in batches...")
    execute_batch(cur, INSERT_SQL, batch, page_size=500)
    conn.commit()

    cur.execute("SELECT count(*) FROM facilities")
    count = cur.fetchone()[0]
    cur.close()
    conn.close()
    print(f"Done! {count} facilities in database.")


if __name__ == "__main__":
    main()
