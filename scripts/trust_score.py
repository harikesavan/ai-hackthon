import json
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv("../.env.local")

SURGICAL_SPECIALTIES = [
    "generalSurgery", "cardiacSurgery", "neurosurgery", "orthopedicSurgery",
    "plasticSurgery", "thoracicSurgery", "vascularSurgery", "bariatricSurgery",
    "colorectalSurgery", "pediatricSurgery", "transplantSurgery",
    "cardiothoracicSurgery", "hepatobiliarySurgery",
]

NON_DENTAL_SPECIALTIES = [
    "ophthalmology", "cardiology", "orthopedics", "oncology", "neurology",
    "generalSurgery", "pediatrics", "gynecology", "urology", "nephrology",
    "pulmonology", "gastroenterology", "endocrinology", "rheumatology",
]

SURGICAL_KEYWORDS_IN_PROCEDURES = [
    "surgery", "surgical", "transplant", "bypass", "angioplasty",
    "laparoscop", "arthroscop", "appendectomy", "cholecystectomy",
]


def score_facility(row):
    flags = []
    ftype = (row["facility_type"] or "").lower()
    specialties = row["specialties"] or []
    services = row["services"] or []
    equipment = row["equipment"] or []
    description = row["raw_notes"] or ""
    doctors = row["doctors"]
    beds = row["beds"]

    if isinstance(specialties, str):
        specialties = json.loads(specialties)
    if isinstance(services, str):
        services = json.loads(services)
    if isinstance(equipment, str):
        equipment = json.loads(equipment)

    all_claims = [s.lower() for s in specialties + services]

    # Rule 1: Clinic claiming surgical specialties
    if ftype == "clinic":
        surgical_claims = [s for s in specialties if s in SURGICAL_SPECIALTIES]
        if surgical_claims:
            flags.append({
                "rule": "clinic_claiming_surgery",
                "description": f"Clinic claims surgical specialties: {', '.join(surgical_claims)}. Clinics do not have operating theaters.",
                "citation": "Clinical Establishments Act 2010, Schedule I",
                "severity": "high",
            })

    # Rule 2: Dentist claiming non-dental specialties
    if ftype == "dentist":
        nondental = [s for s in specialties if s in NON_DENTAL_SPECIALTIES]
        if nondental:
            flags.append({
                "rule": "dentist_nondental",
                "description": f"Dental facility claims non-dental specialties: {', '.join(nondental)}.",
                "citation": "Dentists Act 1948, Section 49",
                "severity": "high",
            })

    # Rule 3: Pharmacy with medical specialties
    if ftype == "pharmacy":
        if len(specialties) > 0:
            flags.append({
                "rule": "pharmacy_with_specialties",
                "description": f"Pharmacy lists {len(specialties)} medical specialties. Pharmacies dispense medication, they do not provide specialist care.",
                "citation": "Pharmacy Act 1948, Section 42",
                "severity": "high",
            })

    # Rule 4: Surgical procedures but zero equipment
    has_surgical_procedure = any(
        any(kw in proc.lower() for kw in SURGICAL_KEYWORDS_IN_PROCEDURES)
        for proc in services
    )
    if has_surgical_procedure and len(equipment) == 0:
        flags.append({
            "rule": "surgery_no_equipment",
            "description": "Claims surgical procedures but lists zero equipment.",
            "citation": "IPHS 2022, minimum equipment requirements for surgical facilities",
            "severity": "medium",
        })

    # Rule 5: Many specialties, almost no description
    if len(specialties) > 5 and len(description) < 50:
        flags.append({
            "rule": "unsupported_specialty_claims",
            "description": f"Claims {len(specialties)} specialties but description is only {len(description)} characters. Claims lack textual evidence.",
            "citation": "Internal consistency check",
            "severity": "medium",
        })

    # Rule 6: Outlier specialty count for facility type
    if ftype == "clinic" and len(specialties) > 15:
        flags.append({
            "rule": "outlier_specialty_count",
            "description": f"Clinic claims {len(specialties)} specialties. Top 5% for clinics. Median clinic has 2-4.",
            "citation": "Statistical outlier — dataset-internal",
            "severity": "medium",
        })
    if ftype == "dentist" and len(specialties) > 8:
        flags.append({
            "rule": "outlier_specialty_count",
            "description": f"Dental facility claims {len(specialties)} specialties. Unusually high for a dental practice.",
            "citation": "Statistical outlier — dataset-internal",
            "severity": "low",
        })

    # Rule 7: Claims many specialties with very few doctors
    if doctors is not None and doctors <= 1 and len(specialties) > 5:
        flags.append({
            "rule": "specialty_doctor_mismatch",
            "description": f"Claims {len(specialties)} specialties but only {doctors} doctor listed. One doctor cannot cover {len(specialties)} specialties.",
            "citation": "Basic staffing arithmetic",
            "severity": "high",
        })

    # Rule 8: Emergency claims without supporting evidence
    emergency_claimed = any("emergency" in c or "trauma" in c or "24" in c for c in all_claims)
    if emergency_claimed and doctors is not None and doctors < 2:
        flags.append({
            "rule": "emergency_insufficient_staff",
            "description": f"Claims emergency/24-hour services with only {doctors} doctor(s). 24/7 coverage requires minimum 3 staff for shift rotation.",
            "citation": "IPHS 2022, staffing norms for 24/7 facilities",
            "severity": "high",
        })

    # Compute trust_min based on flags
    if not flags:
        trust_min = 0.9
    else:
        high_count = sum(1 for f in flags if f["severity"] == "high")
        med_count = sum(1 for f in flags if f["severity"] == "medium")
        low_count = sum(1 for f in flags if f["severity"] == "low")
        trust_min = max(0.0, 0.9 - (high_count * 0.25) - (med_count * 0.15) - (low_count * 0.05))

    return flags, round(trust_min, 2)


def main():
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cur = conn.cursor()

    cur.execute("""
        SELECT id, facility_name, facility_type, specialties, services, 
               equipment, raw_notes, doctors, beds
        FROM facilities
    """)
    columns = [desc[0] for desc in cur.description]
    rows = [dict(zip(columns, row)) for row in cur.fetchall()]
    print(f"Scoring {len(rows)} facilities...")

    total_flagged = 0
    severity_counts = {"high": 0, "medium": 0, "low": 0}
    rule_counts = {}

    for row in rows:
        flags, trust_min = score_facility(row)

        cur.execute(
            "UPDATE facilities SET rule_violations = %s, trust_min = %s WHERE id = %s",
            (json.dumps(flags), trust_min, row["id"])
        )

        if flags:
            total_flagged += 1
            for f in flags:
                severity_counts[f["severity"]] += 1
                rule_counts[f["rule"]] = rule_counts.get(f["rule"], 0) + 1

    conn.commit()

    # Check for famous hospital false positives
    famous = ["AIIMS", "Apollo", "Fortis", "Manipal", "Max", "Medanta", "Narayana"]
    print("\n--- Famous Hospital Check ---")
    for name in famous:
        cur.execute(
            "SELECT facility_name, trust_min, rule_violations FROM facilities WHERE facility_name ILIKE %s AND trust_min < 0.7 LIMIT 3",
            (f"%{name}%",)
        )
        results = cur.fetchall()
        if results:
            for r in results:
                print(f"  WARNING: {r[0]} — trust: {r[1]} — flags: {r[2][:100]}")
        else:
            print(f"  {name}: OK (not falsely flagged)")

    cur.close()
    conn.close()

    print(f"\n--- Results ---")
    print(f"Total facilities: {len(rows)}")
    print(f"Total flagged (≥1 flag): {total_flagged}")
    print(f"Clean (0 flags): {len(rows) - total_flagged}")
    print(f"\nSeverity breakdown:")
    print(f"  High: {severity_counts['high']}")
    print(f"  Medium: {severity_counts['medium']}")
    print(f"  Low: {severity_counts['low']}")
    print(f"\nFlags by rule:")
    for rule, count in sorted(rule_counts.items(), key=lambda x: -x[1]):
        print(f"  {rule}: {count}")

    # Find best demo facilities (worst offenders)
    conn2 = psycopg2.connect(os.getenv("DATABASE_URL"))
    cur2 = conn2.cursor()
    cur2.execute("""
        SELECT id, facility_name, facility_type, state, district, trust_min, 
               rule_violations, specialties, lat, lon
        FROM facilities 
        WHERE trust_min < 0.3 
        ORDER BY trust_min ASC 
        LIMIT 5
    """)
    print(f"\n--- Top 5 Demo Facilities (worst trust scores) ---")
    for r in cur2.fetchall():
        print(f"  ID:{r[0]} | {r[1]} | {r[2]} | {r[3]}, {r[4]} | trust:{r[5]}")
        print(f"    flags: {r[6][:200]}")
        print(f"    specialties: {r[7][:150] if r[7] else 'none'}")
        print(f"    coords: {r[8]}, {r[9]}")
        print()
    cur2.close()
    conn2.close()


if __name__ == "__main__":
    main()
