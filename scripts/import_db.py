"""
Run AFTER extract.py finishes.
Reads data/extracted.json and inserts into PostgreSQL.
"""
import json
import os
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
import pgeocode

load_dotenv("../.env.local")
nomi = pgeocode.Nominatim("in")


def pincode_to_coords(pincode):
    if not pincode or pincode == "None" or pincode == "null":
        return None, None
    try:
        result = nomi.query_postal_code(str(pincode).strip()[:6])
        if result is not None and not (result.latitude != result.latitude):
            return float(result.latitude), float(result.longitude)
    except Exception:
        pass
    return None, None


def trust_min_from_signals(record):
    scores = []

    confidence = record.get("extraction_confidence", "medium")
    conf_map = {"high": 0.9, "medium": 0.6, "low": 0.3}
    scores.append(conf_map.get(confidence, 0.5))

    violations = record.get("rule_violations", [])
    if isinstance(violations, list):
        violation_score = max(0, 1.0 - len(violations) * 0.2)
        scores.append(violation_score)

    percentile = record.get("peer_anomaly_percentile")
    if percentile is not None:
        peer_score = 1.0 - (percentile / 100.0)
        scores.append(peer_score)

    return min(scores) if scores else 0.5


def main():
    with open("../data/extracted.json") as f:
        records = json.load(f)

    print(f"Importing {len(records)} records...")

    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cur = conn.cursor()

    inserted = 0
    for r in records:
        if "error" in r:
            continue

        lat, lon = pincode_to_coords(r.get("pincode"))

        trust = trust_min_from_signals(r)

        cur.execute(
            """INSERT INTO facilities (
                facility_name, facility_type, facility_type_confidence, ownership_type,
                state, district, pincode, lat, lon,
                beds, doctors, services, equipment, specialties,
                staff_details, operating_hours, emergency_available,
                extraction_confidence, unsupported_claims,
                rule_violations, peer_anomaly_percentile, peer_anomaly_flags,
                trust_min, raw_notes, raw_summary
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s
            )""",
            (
                r.get("facility_name", "Unknown"),
                r.get("facility_type"),
                r.get("facility_type_confidence"),
                r.get("ownership_type"),
                r.get("state"),
                r.get("district"),
                r.get("pincode"),
                lat,
                lon,
                r.get("beds"),
                r.get("doctors"),
                json.dumps(r.get("services", [])),
                json.dumps(r.get("equipment", [])),
                json.dumps(r.get("specialties", [])),
                json.dumps(r.get("staff_details", [])),
                r.get("operating_hours"),
                r.get("emergency_available"),
                r.get("extraction_confidence"),
                json.dumps(r.get("unsupported_claims", [])),
                json.dumps(r.get("rule_violations", [])),
                r.get("peer_anomaly_percentile"),
                json.dumps(r.get("peer_anomaly_flags", [])),
                trust,
                r.get("raw_notes"),
                r.get("raw_summary"),
            ),
        )
        inserted += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"Imported {inserted} facilities into PostgreSQL.")


if __name__ == "__main__":
    main()
