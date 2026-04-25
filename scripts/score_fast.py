import json, os, psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv
load_dotenv("../.env.local")

SURGICAL = set(["generalSurgery","cardiacSurgery","neurosurgery","orthopedicSurgery","plasticSurgery","thoracicSurgery","vascularSurgery","bariatricSurgery","colorectalSurgery","pediatricSurgery","transplantSurgery","cardiothoracicSurgery","hepatobiliarySurgery"])
NON_DENTAL = set(["ophthalmology","cardiology","orthopedics","oncology","neurology","generalSurgery","pediatrics","gynecology","urology","nephrology"])
SURG_KW = ["surgery","surgical","transplant","bypass","angioplasty","laparoscop"]

conn = psycopg2.connect(os.getenv("DATABASE_URL"))
cur = conn.cursor()
cur.execute("SELECT id, facility_type, specialties, services, equipment, raw_notes, doctors, beds FROM facilities")
rows = cur.fetchall()
print(f"Scoring {len(rows)}...")

updates = []
stats = {"flagged": 0, "rules": {}}

for (fid, ftype, specs, services, equip, desc, doctors, beds) in rows:
    ftype = (ftype or "").lower()
    if isinstance(specs, str): specs = json.loads(specs)
    if isinstance(services, str): services = json.loads(services)
    if isinstance(equip, str): equip = json.loads(equip)
    if not specs: specs = []
    if not services: services = []
    if not equip: equip = []
    desc = desc or ""

    flags = []

    if ftype == "clinic":
        s = [x for x in specs if x in SURGICAL]
        if s: flags.append({"rule":"clinic_surgery","description":f"Clinic claims: {', '.join(s)}","citation":"Clinical Establishments Act 2010","severity":"high"})

    if ftype == "dentist":
        n = [x for x in specs if x in NON_DENTAL]
        if n: flags.append({"rule":"dentist_nondental","description":f"Dental claims: {', '.join(n)}","citation":"Dentists Act 1948","severity":"high"})

    if ftype == "pharmacy" and len(specs) > 0:
        flags.append({"rule":"pharmacy_specialties","description":f"Pharmacy lists {len(specs)} specialties","citation":"Pharmacy Act 1948","severity":"high"})

    if any(any(k in s.lower() for k in SURG_KW) for s in services) and len(equip) == 0:
        flags.append({"rule":"surgery_no_equipment","description":"Surgical procedures, zero equipment","citation":"IPHS 2022","severity":"medium"})

    if len(specs) > 5 and len(desc) < 50:
        flags.append({"rule":"unsupported_claims","description":f"{len(specs)} specialties, {len(desc)} char desc","citation":"Internal consistency","severity":"medium"})

    if ftype == "clinic" and len(specs) > 15:
        flags.append({"rule":"outlier_specialties","description":f"Clinic claims {len(specs)} specialties","citation":"Statistical outlier","severity":"medium"})

    if doctors is not None and doctors <= 1 and len(specs) > 5:
        flags.append({"rule":"specialty_doctor_mismatch","description":f"{len(specs)} specialties, {doctors} doctor","citation":"Basic staffing","severity":"high"})

    all_claims = [s.lower() for s in specs + services]
    if any("emergency" in c or "24" in c or "trauma" in c for c in all_claims) and doctors is not None and doctors < 2:
        flags.append({"rule":"emergency_understaffed","description":f"Emergency, {doctors} doctor","citation":"IPHS 2022","severity":"high"})

    if not flags:
        trust = 0.9
    else:
        h = sum(1 for f in flags if f["severity"] == "high")
        m = sum(1 for f in flags if f["severity"] == "medium")
        trust = max(0.0, round(0.9 - h * 0.25 - m * 0.15, 2))

    updates.append({"violations": json.dumps(flags), "trust": trust, "id": fid})

    if flags:
        stats["flagged"] += 1
        for f in flags:
            stats["rules"][f["rule"]] = stats["rules"].get(f["rule"], 0) + 1

print("Writing to DB...")
execute_batch(cur, "UPDATE facilities SET rule_violations = %(violations)s, trust_min = %(trust)s WHERE id = %(id)s", updates, page_size=500)
conn.commit()

print(f"\nTotal: {len(rows)}")
print(f"Flagged: {stats['flagged']}")
print(f"Clean: {len(rows) - stats['flagged']}")
for r, c in sorted(stats["rules"].items(), key=lambda x: -x[1]):
    print(f"  {r}: {c}")

cur.execute("SELECT facility_name, trust_min FROM facilities WHERE facility_name ILIKE ANY(%s) AND trust_min < 0.7", (["%AIIMS%","%Apollo%","%Fortis%","%Manipal%","%Max %","%Medanta%"],))
bad = cur.fetchall()
print(f"\nFamous hospital check: {'OK - none falsely flagged' if not bad else ''}")
for b in bad:
    print(f"  WARNING: {b[0]} trust={b[1]}")

cur.execute("SELECT id, facility_name, facility_type, state, district, trust_min, lat, lon FROM facilities WHERE trust_min < 0.3 ORDER BY trust_min LIMIT 5")
print("\nTop 5 worst (demo candidates):")
for r in cur.fetchall():
    print(f"  ID:{r[0]} {r[1]} ({r[2]}) {r[3]},{r[4]} trust={r[5]} coords={r[6]},{r[7]}")

cur.close()
conn.close()
