import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from dotenv import load_dotenv

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

load_dotenv(".env.local", override=False)

app = FastAPI()

def get_db_connection():
    url = os.getenv("DATABASE_URL", "")
    url = url.replace("channel_binding=require", "").rstrip("&").rstrip("?")
    return psycopg2.connect(url)

@tool
def search_facilities(state: str, specialty: str, facility_type: str = "", min_trust: float = 0.0, limit: int = 20) -> list:
    """Search facilities by location and specialty."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = "SELECT * FROM facilities WHERE state ILIKE %s AND specialties::text ILIKE %s AND trust_min >= %s"
            params = [f"%{state}%", f"%{specialty}%", min_trust]
            
            if facility_type:
                query += " AND facility_type ILIKE %s"
                params.append(f"%{facility_type}%")
                
            query += " ORDER BY trust_min DESC LIMIT %s"
            params.append(limit)
            
            cur.execute(query, params)
            return cur.fetchall()
    finally:
        conn.close()

@tool
def get_facility(facility_id: int) -> dict:
    """Get full details for one facility."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM facilities WHERE id = %s", [facility_id])
            res = cur.fetchone()
            return res if res else {}
    finally:
        conn.close()

@tool
def find_nearby(lat: float, lon: float, radius_km: float = 50.0, specialty: str = "", min_trust: float = 0.0, limit: int = 10) -> list:
    """Find facilities near a location."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
            SELECT *, 
            (6371 * acos(cos(radians(%s)) * cos(radians(lat)) * cos(radians(lon) - radians(%s)) + sin(radians(%s)) * sin(radians(lat)))) AS distance_km
            FROM facilities
            WHERE trust_min >= %s
            """
            params = [lat, lon, lat, min_trust]
            
            if specialty:
                query += " AND specialties::text ILIKE %s"
                params.append(f"%{specialty}%")
                
            query += " AND lat IS NOT NULL AND lon IS NOT NULL "
            
            query += " ORDER BY distance_km ASC LIMIT %s"
            params.append(limit)
            
            cur.execute(query, params)
            
            results = cur.fetchall()
            return [r for r in results if r['distance_km'] is not None and r['distance_km'] <= radius_km]
    finally:
        conn.close()

@tool
def find_alternative(lat: float, lon: float, specialty: str, min_trust: float = 0.7) -> dict:
    """Find nearest high-trust alternative."""
    res = find_nearby.invoke({"lat": lat, "lon": lon, "radius_km": 200.0, "specialty": specialty, "min_trust": min_trust, "limit": 1})
    return res[0] if res else {}

@tool
def get_stats(state: str, district: str = "") -> dict:
    """Get stats for a state or district."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = "SELECT count(*) as total, count(*) FILTER (WHERE trust_min < 0.5) as flagged, avg(trust_min) as avg_trust FROM facilities WHERE state ILIKE %s"
            params = [f"%{state}%"]
            
            if district:
                query += " AND district ILIKE %s"
                params.append(f"%{district}%")
                
            cur.execute(query, params)
            return cur.fetchone()
    finally:
        conn.close()

@tool
def submit_final_answer(
    recommendation_facility_id: int,
    recommendation_name: str,
    recommendation_lat: float,
    recommendation_lon: float,
    recommendation_trust: float,
    recommendation_reason: str,
    warnings: List[dict],
    reasoning: List[dict]
):
    """
    Call this tool to submit the final answer. 
    warnings should be a list of dicts with keys: facilityId, name, lat, lon, trustMin, reason.
    reasoning should be a list of dicts with keys: step, text.
    """
    return "Done"

tools = [search_facilities, get_facility, find_nearby, find_alternative, get_stats, submit_final_answer]

system_prompt = """You are a healthcare facility advisor for NGOs in India.
Database: 10,000 facilities with trust scores.

IMPORTANT: Be fast. Use at most 2 tool calls total, then submit_final_answer.

Steps:
1. Call search_facilities ONCE to find matching facilities
2. Look at the results — pick the best (highest trust) and worst (lowest trust)
3. Call submit_final_answer immediately with your recommendation and warnings

Do NOT call get_facility, find_nearby, or find_alternative unless absolutely necessary.
Do NOT make more than 2 tool calls before submitting your answer.

In your reasoning, explain:
- What you searched for
- Which facility you recommend and why (cite trust score)
- Which facilities are suspicious and why (cite specific rule violations from the data)
- What's at stake for the patient

Be direct. Name the best option. Warn about bad ones.
"""

_agent = None

def get_agent():
    global _agent
    if _agent is None:
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=os.getenv("OPENAI_API_KEY"))
        _agent = create_react_agent(llm, tools, max_iterations=4)
    return _agent

class QueryRequest(BaseModel):
    message: str

@app.get("/health")
async def health():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM facilities")
        count = cur.fetchone()[0]
        conn.close()
        return {"status": "ok", "facilities": count, "openai_key_set": bool(os.getenv("OPENAI_API_KEY"))}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@app.get("/test-query")
async def test_query():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, facility_name, facility_type, state, trust_min FROM facilities WHERE state ILIKE '%Rajasthan%' AND specialties::text ILIKE '%cardio%' ORDER BY trust_min ASC LIMIT 3")
        results = cur.fetchall()
        conn.close()
        return {"status": "ok", "results": results}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@app.post("/query")
async def run_query(req: QueryRequest):
    import sys
    print(f"[QUERY] Received: {req.message}", flush=True, file=sys.stderr)
    try:
        agent_executor = get_agent()
        print("[QUERY] Agent initialized, invoking...", flush=True, file=sys.stderr)
        response = agent_executor.invoke({
            "messages": [
                SystemMessage(content=system_prompt),
                HumanMessage(content=req.message)
            ]
        })

        final_action = None
        for msg in reversed(response["messages"]):
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    if tc["name"] == "submit_final_answer":
                        final_action = tc["args"]
                        break
            if final_action:
                break

        if not final_action:
            return {"error": "Agent did not use submit_final_answer tool correctly.", "query": req.message}

        map_center = [final_action["recommendation_lon"], final_action["recommendation_lat"]]
        highlight_green = [final_action["recommendation_facility_id"]]
        highlight_red = [w["facilityId"] for w in final_action.get("warnings", [])]

        return {
            "query": req.message,
            "recommendation": {
                "facilityId": final_action["recommendation_facility_id"],
                "name": final_action["recommendation_name"],
                "lat": final_action["recommendation_lat"],
                "lon": final_action["recommendation_lon"],
                "trustMin": final_action["recommendation_trust"],
                "reason": final_action["recommendation_reason"]
            },
            "reasoning": final_action.get("reasoning", []),
            "warnings": final_action.get("warnings", []),
            "mapState": {
                "center": map_center,
                "zoom": 10,
                "highlightGreen": highlight_green,
                "highlightRed": highlight_red
            }
        }
    except Exception as e:
        return {"error": str(e), "query": req.message}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
