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

function deriveSourceSupport(facility) {
  const conf = facility.extraction_confidence;
  const unsupportedCount = Array.isArray(facility.unsupported_claims)
    ? facility.unsupported_claims.length
    : 0;

  let base;
  if (conf === "high") base = 30;
  else if (conf === "medium") base = 22;
  else if (conf === "low") base = 12;
  else base = 18;

  const penalty = Math.min(unsupportedCount * 4, base);
  const score = Math.max(0, base - penalty);

  let reason;
  if (unsupportedCount === 0) {
    reason = `Extraction confidence ${conf ?? "unknown"}; no unsupported claims flagged.`;
  } else {
    reason = `${unsupportedCount} extracted claim${unsupportedCount === 1 ? "" : "s"} not supported by source raw notes (extraction confidence: ${conf ?? "unknown"}).`;
  }
  return { score, max: 30, reason };
}

function deriveIphsConflict(facility) {
  const violations = Array.isArray(facility.rule_violations) ? facility.rule_violations : [];
  if (violations.length === 0) {
    return {
      score: 38,
      max: 40,
      reason: "No IPHS rule violations detected by automated checks.",
    };
  }

  const score = Math.max(0, 40 - violations.length * 10);
  const sample = violations
    .slice(0, 2)
    .map((v) => v.rule || v.description || "rule")
    .join("; ");
  const more = violations.length > 2 ? ` (+${violations.length - 2} more)` : "";
  return {
    score,
    max: 40,
    reason: `${violations.length} IPHS rule violation${violations.length === 1 ? "" : "s"}: ${sample}${more}.`,
  };
}

function derivePeerAnomaly(facility) {
  const pct = facility.peer_anomaly_percentile;
  const flags = Array.isArray(facility.peer_anomaly_flags) ? facility.peer_anomaly_flags : [];
  const flagCount = flags.length;

  if (pct === null || pct === undefined) {
    if (flagCount > 0) {
      const score = Math.max(0, 25 - flagCount * 7);
      return {
        score,
        max: 30,
        reason: `${flagCount} peer-anomaly flag${flagCount === 1 ? "" : "s"}: ${flags[0]}`,
      };
    }
    return {
      score: 25,
      max: 30,
      reason: "No peer comparison data available — neutral score applied.",
    };
  }

  const distance = Math.abs(pct - 50);
  let score;
  if (distance <= 20) score = 28;
  else if (distance <= 35) score = 20;
  else if (distance <= 45) score = 12;
  else score = 6;

  score = Math.max(0, score - flagCount * 4);

  const reason =
    flagCount > 0
      ? `Peer percentile ${Math.round(pct)} (${distance.toFixed(0)} from median); ${flagCount} flag${flagCount === 1 ? "" : "s"}: ${flags[0]}`
      : `Peer percentile ${Math.round(pct)} — within ${distance.toFixed(0)} points of median for similar facilities.`;
  return { score, max: 30, reason };
}

function deriveEvidenceSpans(facility) {
  const spans = [];

  const unsupported = Array.isArray(facility.unsupported_claims)
    ? facility.unsupported_claims
    : [];
  for (const claim of unsupported) {
    const field = claim.field;
    const validField = ["services", "specialties", "equipment", "staff", "facilityType"].includes(
      field,
    )
      ? field
      : "specialties";
    spans.push({
      claim: claim.value || "Unnamed claim",
      claimField: validField,
      supportStatus: "unsupported",
      sourceSentence: null,
      extractionRationale: claim.reason || "Claim not supported by source raw notes.",
    });
  }

  const violations = Array.isArray(facility.rule_violations) ? facility.rule_violations : [];
  for (const violation of violations) {
    spans.push({
      claim: violation.rule || violation.description || "IPHS rule violation",
      claimField: "specialties",
      supportStatus: "contradicted",
      sourceSentence: null,
      extractionRationale: violation.description || "Violates IPHS standard.",
      iphsRuleId: violation.citation || violation.rule || undefined,
    });
  }

  const peerFlags = Array.isArray(facility.peer_anomaly_flags) ? facility.peer_anomaly_flags : [];
  for (const flag of peerFlags) {
    spans.push({
      claim: "Peer-group anomaly",
      claimField: "specialties",
      supportStatus: "insufficient",
      sourceSentence: null,
      extractionRationale: flag,
    });
  }

  if (spans.length === 0) {
    spans.push({
      claim: facility.facility_name || "facility",
      claimField: "facilityType",
      supportStatus: "insufficient",
      sourceSentence: null,
      extractionRationale: `No automated audit signals detected. Extraction confidence: ${facility.extraction_confidence ?? "unknown"}.`,
    });
  }

  return spans;
}

(async () => {
  const url = loadDatabaseUrl();
  const sql = postgres(url, { max: 1 });

  try {
    const all = await sql`
      SELECT
        id,
        facility_name,
        extraction_confidence,
        unsupported_claims,
        rule_violations,
        peer_anomaly_percentile,
        peer_anomaly_flags,
        trust_breakdown
      FROM facilities
    `;

    let updated = 0;
    let skipped = 0;
    const total = all.length;

    for (const facility of all) {
      if (facility.trust_breakdown) {
        skipped += 1;
        continue;
      }

      const sourceSupport = deriveSourceSupport(facility);
      const iphsConflict = deriveIphsConflict(facility);
      const peerAnomaly = derivePeerAnomaly(facility);
      const totalScore = sourceSupport.score + iphsConflict.score + peerAnomaly.score;
      const breakdown = {
        sourceSupport,
        iphsConflict,
        peerAnomaly,
        total: totalScore,
      };
      const spans = deriveEvidenceSpans(facility);

      await sql`
        UPDATE facilities
        SET trust_breakdown = ${sql.json(breakdown)},
            evidence_spans = ${sql.json(spans)}
        WHERE id = ${facility.id}
      `;

      updated += 1;
      if (updated % 500 === 0) {
        console.log(`  ${updated}/${total - skipped} derived…`);
      }
    }

    console.log(`Done. Updated ${updated}; preserved ${skipped} hand-curated.`);
  } finally {
    await sql.end();
  }
})();
