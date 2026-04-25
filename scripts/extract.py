"""
Person A runs this script.
Reads the Excel file, extracts structured data from each row using OpenAI.
Two calls per row: extract + hallucination check.
Outputs: data/extracted.json
"""
import json
import asyncio
import os
import pandas as pd
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv(".env.local")
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

EXTRACT_PROMPT = """You are extracting structured healthcare facility data from an Indian facility record.
Extract into the following JSON schema. If a field is not mentioned, set it to null — do NOT guess.
Infer facility_type from context if not explicitly stated (use bed count, staff, services as signals).
Set facility_type_confidence to "high", "medium", or "low".

Return ONLY valid JSON:
{
  "facility_name": "string",
  "facility_type": "Sub-Centre | PHC | CHC | District Hospital | State Hospital | Private Hospital | Clinic | null",
  "facility_type_confidence": "high | medium | low",
  "ownership_type": "Government | Private | Trust | Mission | null",
  "state": "string | null",
  "district": "string | null",
  "pincode": "string | null",
  "beds": "number | null",
  "doctors": "number | null",
  "services": ["list of services offered"],
  "equipment": ["list of equipment"],
  "specialties": ["list of medical specialties"],
  "staff_details": [{"specialty": "string"}],
  "operating_hours": "string | null",
  "emergency_available": "boolean | null",
  "raw_summary": "One sentence summary of what this facility actually is"
}"""

HALLUCINATION_CHECK_PROMPT = """You are verifying an AI extraction against source text.
Given the ORIGINAL TEXT and the EXTRACTED JSON, identify claims in the extraction
that are NOT directly supported by a specific sentence or phrase in the source text.

Be strict. If the source says "cardiology" and extraction says "Cardiac Surgery", flag it.
If a field is null in the extraction, skip it.

Return ONLY valid JSON:
{
  "unsupported_claims": [
    {"field": "services", "value": "Cardiac Surgery", "reason": "Source says cardiology OPD, not surgery"}
  ],
  "extraction_confidence": "high | medium | low"
}

If everything checks out, return:
{"unsupported_claims": [], "extraction_confidence": "high"}"""


async def extract_one(row_text: str, row_structured: dict, semaphore: asyncio.Semaphore):
    async with semaphore:
        try:
            combined_input = f"Structured fields:\n{json.dumps(row_structured, default=str)}\n\nUnstructured notes:\n{row_text}"

            extract_response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": EXTRACT_PROMPT},
                    {"role": "user", "content": combined_input},
                ],
                temperature=0,
                response_format={"type": "json_object"},
            )
            extracted = json.loads(extract_response.choices[0].message.content)

            check_response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": HALLUCINATION_CHECK_PROMPT},
                    {
                        "role": "user",
                        "content": f"ORIGINAL TEXT:\n{row_text}\n\nEXTRACTED JSON:\n{json.dumps(extracted)}",
                    },
                ],
                temperature=0,
                response_format={"type": "json_object"},
            )
            check = json.loads(check_response.choices[0].message.content)

            extracted["unsupported_claims"] = check.get("unsupported_claims", [])
            extracted["extraction_confidence"] = check.get("extraction_confidence", "medium")
            extracted["raw_notes"] = row_text

            return extracted
        except Exception as e:
            return {"error": str(e), "raw_notes": row_text}


async def main():
    excel_path = "data/VF_Hackathon_Dataset_India_Large.xlsx"
    if not os.path.exists(excel_path):
        print(f"ERROR: Put the Excel file at {excel_path}")
        print("Download it from the hackathon challenge page.")
        return

    print("Reading Excel file...")
    df = pd.read_excel(excel_path)
    print(f"Loaded {len(df)} rows, columns: {list(df.columns)}")

    print("\n--- First 3 rows ---")
    print(df.head(3).to_string())

    print(f"\n--- Column types ---")
    print(df.dtypes)

    # Find the unstructured text column (usually the longest text column)
    text_cols = df.select_dtypes(include=["object"]).columns
    avg_lengths = {col: df[col].astype(str).str.len().mean() for col in text_cols}
    notes_col = max(avg_lengths, key=avg_lengths.get)
    print(f"\nLikely unstructured notes column: '{notes_col}' (avg length: {avg_lengths[notes_col]:.0f} chars)")

    # TEST MODE: Extract first 20 rows only
    test_count = int(os.getenv("EXTRACT_COUNT", "20"))
    print(f"\nExtracting {test_count} rows (set EXTRACT_COUNT env var for more)...")

    semaphore = asyncio.Semaphore(30)
    tasks = []

    for idx in range(min(test_count, len(df))):
        row = df.iloc[idx]
        row_text = str(row.get(notes_col, ""))
        row_structured = {col: str(row[col]) for col in df.columns if col != notes_col and pd.notna(row[col])}
        tasks.append(extract_one(row_text, row_structured, semaphore))

    results = await asyncio.gather(*tasks)

    output_path = "data/extracted.json"
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2, default=str)

    errors = sum(1 for r in results if "error" in r)
    print(f"\nDone! {len(results)} extracted, {errors} errors")
    print(f"Saved to {output_path}")
    print(f"\nSample output (first row):")
    print(json.dumps(results[0], indent=2, default=str)[:2000])


if __name__ == "__main__":
    asyncio.run(main())
