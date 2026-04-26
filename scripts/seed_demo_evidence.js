const fs = require("fs");
const path = require("path");
const postgres = require("postgres");

function loadDatabaseUrl() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const text = fs.readFileSync(envPath, "utf-8");
  const line = text.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not found in .env.local");
  return line
    .slice("DATABASE_URL=".length)
    .replace(/^['"]/, "")
    .replace(/['"]$/, "")
    .trim();
}

const DEMO = [
  {
    id: 24843,
    name: "Tiny Hearts Hospital Thanjavur",
    summary:
      "High-trust pediatric hospital. Claims directly verified by source mention with capacity and specialty detail.",
    review: "confirmed_real",
    breakdown: {
      sourceSupport: {
        score: 28,
        max: 30,
        reason:
          "Pediatric ICU and Cardiology both directly named in source (Fetal Medicine, Paediatric Cardiology, Genetics, Neonatal & Paediatric ICU). 24/7 operation explicitly stated.",
      },
      iphsConflict: {
        score: 38,
        max: 40,
        reason:
          "Hospital-tier facility with pediatric ICU meets IPHS 2022 Chapter 6 (DH Pediatrics) staffing and equipment expectations.",
      },
      peerAnomaly: {
        score: 25,
        max: 30,
        reason:
          "Specialty count and bed estimates within 1σ of peer DH-level pediatric hospitals in Tamil Nadu.",
      },
      total: 91,
    },
    evidence: [
      {
        claim: "Operates 24/7",
        claimField: "services",
        supportStatus: "verified",
        sourceSentence: "Operates 24/7",
        extractionRationale:
          "Direct verbatim source mention. No ambiguity; service item explicitly listed.",
      },
      {
        claim: "Neonatal & Paediatric ICU",
        claimField: "services",
        supportStatus: "verified",
        sourceSentence:
          "Fetal Medicine, Paediatric Cardiology, Genetics, Neonatal & Paediatric ICU",
        extractionRationale:
          "Direct mention with service category. Pediatric ICU presence supports general pediatric admission capability.",
      },
      {
        claim: "Pediatric Cardiology program",
        claimField: "services",
        supportStatus: "verified",
        sourceSentence:
          "Fetal Medicine, Paediatric Cardiology, Genetics, Neonatal & Paediatric ICU",
        extractionRationale:
          "Direct mention. Sub-specialty claim supported by source enumeration.",
      },
      {
        claim: "Internal Medicine specialty",
        claimField: "specialties",
        supportStatus: "insufficient",
        sourceSentence: null,
        extractionRationale:
          "Source enumerates pediatric specialties only; internal medicine is not named. May exist but cannot be confirmed from raw notes.",
      },
    ],
  },
  {
    id: 15480,
    name: "Abhineet Nursing Homes and Laparoscopic Centre",
    summary:
      "Clinic-tier facility claiming advanced surgical and cardiac specialties without raw-notes evidence. Likely ghost capability claim.",
    review: "confirmed_ghost",
    breakdown: {
      sourceSupport: {
        score: 6,
        max: 30,
        reason:
          "5 specialty claims (familyMedicine, cardiology, gynecologyAndObstetrics, internalMedicine, surgery) but raw notes contain only the location string 'Top Clinic in A.P.Colony, Gaya'. No clinical detail supports cardio or surgical capability.",
      },
      iphsConflict: {
        score: 4,
        max: 40,
        reason:
          "IPHS-CHC-2022-OT-04: Operating theatre and laparoscopic surgery require dedicated anaesthesia provider, blood bank linkage, and minimum bed count. None evidenced for this Clinic-tier facility.",
      },
      peerAnomaly: {
        score: 8,
        max: 30,
        reason:
          "97th percentile specialty-count anomaly for Clinic facilities in Bihar (median 1, this facility 4). Cardiology claim at clinic tier is unusual.",
      },
      total: 18,
    },
    evidence: [
      {
        claim: "Cardiology specialty",
        claimField: "specialties",
        supportStatus: "contradicted",
        sourceSentence: "Top Clinic in A.P.Colony, Gaya",
        extractionRationale:
          "Source mentions only location. No clinical detail, no cardiologist staff, no cardiac equipment listed. Clinic-tier facility cannot register cardiology under IPHS without qualified specialist + equipment.",
        iphsRuleId: "IPHS-CHC-CARDIO-2022-12",
      },
      {
        claim: "Laparoscopic surgery offered",
        claimField: "services",
        supportStatus: "unsupported",
        sourceSentence: null,
        extractionRationale:
          "Service is in extracted services list but raw notes do not mention surgical capability, theatre, or anaesthesia provider. Cannot be verified.",
        iphsRuleId: "IPHS-CHC-OT-2022-04",
      },
      {
        claim: "Gynecology and obstetrics",
        claimField: "specialties",
        supportStatus: "unsupported",
        sourceSentence: null,
        extractionRationale:
          "Specialty claimed in extracted data but source raw notes contain no obstetric or gynecological mention.",
      },
      {
        claim: "Family medicine",
        claimField: "specialties",
        supportStatus: "insufficient",
        sourceSentence: "Top Clinic in A.P.Colony, Gaya",
        extractionRationale:
          "A clinic generically may offer family medicine. No explicit confirmation but plausible at this tier.",
      },
    ],
  },
  {
    id: 15813,
    name: "Al-Shifa Surgical & Maternity Hospital",
    summary:
      "Hospital-tier facility, name suggests surgical and maternity capability, but extracted raw notes are minimal. Trust is partially supported by name pattern, not clinical detail.",
    review: "needs_visit",
    breakdown: {
      sourceSupport: {
        score: 12,
        max: 30,
        reason:
          "Specialty claims (obstetrics, gynecology, internal medicine) align with facility name pattern, but raw notes contain only the word 'Hospital'. Name-based inference is weak evidence.",
      },
      iphsConflict: {
        score: 30,
        max: 40,
        reason:
          "Hospital-tier facility with maternity claim is not contradicted by IPHS standards but lacks confirmation of operating theatre, anesthesia provider, or blood storage required for C-section per IPHS DH guidelines.",
      },
      peerAnomaly: {
        score: 20,
        max: 30,
        reason:
          "Specialty count within normal range for Hospital tier in Bihar. No statistical outlier.",
      },
      total: 62,
    },
    evidence: [
      {
        claim: "Obstetrics and maternity care",
        claimField: "specialties",
        supportStatus: "unsupported",
        sourceSentence: "Hospital",
        extractionRationale:
          "Specialty inferred from facility name 'Surgical & Maternity Hospital'. Raw notes contain no clinical detail to support the claim. Name-based inference only.",
      },
      {
        claim: "Surgical capability",
        claimField: "specialties",
        supportStatus: "unsupported",
        sourceSentence: "Hospital",
        extractionRationale:
          "Specialty implied by facility name. No raw-notes confirmation of operating theatre, anesthesia, or surgeon staff.",
        iphsRuleId: "IPHS-DH-OT-2022-06",
      },
      {
        claim: "Internal medicine",
        claimField: "specialties",
        supportStatus: "insufficient",
        sourceSentence: null,
        extractionRationale:
          "Plausible for Hospital tier but no explicit raw evidence.",
      },
    ],
  },
  {
    id: 15613,
    name: "AG Clinic",
    summary:
      "Source data is too sparse to verify or contradict any capability claim. Should be triaged for site visit, not auto-classified as fake.",
    review: "insufficient_data",
    breakdown: {
      sourceSupport: {
        score: 8,
        max: 30,
        reason:
          "Raw notes contain only the tautology 'AG Clinic is a Clinic.' No services, no specialties beyond familyMedicine default, no equipment listed. Cannot verify or contradict any capability.",
      },
      iphsConflict: {
        score: 28,
        max: 40,
        reason:
          "Clinic-tier facility with only family medicine specialty does not violate any IPHS standard. Absence of evidence is not evidence of violation.",
      },
      peerAnomaly: {
        score: 22,
        max: 30,
        reason:
          "No anomaly flagged. Specialty footprint matches median Clinic in rural Tamil Nadu.",
      },
      total: 58,
    },
    evidence: [
      {
        claim: "Family medicine",
        claimField: "specialties",
        supportStatus: "insufficient",
        sourceSentence: "AG Clinic is a Clinic.",
        extractionRationale:
          "Raw notes are tautological. Default specialty assumption applied during extraction. Site visit needed to confirm actual services offered.",
      },
    ],
  },
  {
    id: 17771,
    name: "Cuticare Skin & Cosmetology Centre",
    summary:
      "High-trust facility for cosmetic dermatology niche. Extensive source support for cosmetology services. Correctly filtered out for general pediatric queries because excludeKeywords match.",
    review: "confirmed_real",
    breakdown: {
      sourceSupport: {
        score: 27,
        max: 30,
        reason:
          "49 service entries directly extracted from detailed raw notes. Founder credentials verified (Dr. K. Vivekanandh, MBBS, MD, DNB). Hours of operation and address confirmed.",
      },
      iphsConflict: {
        score: 36,
        max: 40,
        reason:
          "Specialty clinic operating within registered scope. No IPHS violation for the niche it claims.",
      },
      peerAnomaly: {
        score: 24,
        max: 30,
        reason:
          "Service count is high (49) but consistent with multi-service cosmetology centre pattern. Not an outlier within its peer group.",
      },
      total: 87,
    },
    evidence: [
      {
        claim: "Cosmetic dermatology services",
        claimField: "specialties",
        supportStatus: "verified",
        sourceSentence:
          "One stop solution for all your skin problems. Cuticare skin & cosmetology centre is a pioneer medical centre providing world-class dermatology and aesthetic services.",
        extractionRationale:
          "Direct verbatim mention. Founder credentials and detailed service list further support.",
      },
      {
        claim: "Pediatric dermatology services",
        claimField: "specialties",
        supportStatus: "verified",
        sourceSentence:
          "Provides pediatric dermatology services",
        extractionRationale:
          "Direct mention in services list. However, this is dermatology only, not general pediatric care — a child with chickenpox should see a pediatrician first, not a cosmetic dermatology centre.",
      },
      {
        claim: "Operating hours",
        claimField: "services",
        supportStatus: "verified",
        sourceSentence:
          "Hours: Mon-Sat 04:00 PM - 09:00 PM; Sunday: Holiday.",
        extractionRationale: "Direct verbatim mention with explicit days and times.",
      },
      {
        claim: "Founder qualifications",
        claimField: "staff",
        supportStatus: "verified",
        sourceSentence:
          "Founder Dr. K. Vivekanandh holds MBBS, MD (Skin & VD), MRCP-SCE (UK), DNB, Fellow in Cosmetology",
        extractionRationale:
          "Direct verbatim mention with full credential string.",
      },
    ],
  },
];

(async () => {
  const url = loadDatabaseUrl();
  const sql = postgres(url);

  try {
    for (const facility of DEMO) {
      const result = await sql`
        UPDATE facilities
        SET
          trust_breakdown = ${sql.json(facility.breakdown)},
          evidence_spans = ${sql.json(facility.evidence)},
          trust_min = ${facility.breakdown.total / 100},
          review_status = ${facility.review},
          raw_summary = ${facility.summary}
        WHERE id = ${facility.id}
        RETURNING id, facility_name, trust_min, review_status
      `;
      if (result.length === 0) {
        console.log(`SKIP id=${facility.id} (${facility.name}) — not in DB`);
      } else {
        console.log(
          `OK   id=${result[0].id} (${result[0].facility_name}) trust=${result[0].trust_min} status=${result[0].review_status}`,
        );
      }
    }
  } finally {
    await sql.end();
  }
})();
