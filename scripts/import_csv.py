import csv
import io
import json
import os
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv

load_dotenv("../.env.local")

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


def main():
    csv_path = "../data/VF_Hackathon_Dataset_India_Large.xlsx - VF_Hackathon_Dataset_India_Larg.csv"

    with open(csv_path, "rb") as f:
        content = f.read().replace(b"\x00", b"")

    reader = csv.DictReader(io.StringIO(content.decode("utf-8", errors="replace")))
    rows = list(reader)
    print(f"Loaded {len(rows)} rows")

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
    for r in rows:
        facility_type = FACILITY_TYPE_MAP.get(r.get("facilityTypeId", ""), None)
        services = parse_json_array(r.get("procedure", "[]"))
        capabilities = parse_json_array(r.get("capability", "[]"))
        all_services = services + capabilities

        description = r.get("description", "") or ""
        if description == "null":
            description = ""

        emergency = any(
            "emergency" in s.lower() or "24" in s.lower() or "trauma" in s.lower()
            for s in all_services + parse_json_array(r.get("specialties", "[]"))
        )

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
            "doctors": parse_int(r.get("numberDoctors")),
            "services": json.dumps(all_services),
            "equipment": json.dumps(parse_json_array(r.get("equipment", "[]"))),
            "specialties": json.dumps(parse_json_array(r.get("specialties", "[]"))),
            "emergency": emergency,
            "ext_conf": "pending",
            "unsup": json.dumps([]),
            "rules": json.dumps([]),
            "peer_flags": json.dumps([]),
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
