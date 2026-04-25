import os
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Garmin Sidecar", version="1.0.0")


class SyncRequest(BaseModel):
    date: str
    garmin_email: str
    garmin_password: str


class SyncResponse(BaseModel):
    status: str
    date: str
    hrv_rmssd: Optional[float] = None
    hrv_status: Optional[str] = None
    resting_hr: Optional[int] = None
    sleep_hours: Optional[float] = None
    sleep_score: Optional[int] = None
    body_battery_min: Optional[int] = None
    body_battery_max: Optional[int] = None
    stress_avg: Optional[int] = None
    steps: Optional[int] = None
    calories_active: Optional[int] = None
    sleep_deep_h: Optional[float] = None
    sleep_rem_h: Optional[float] = None
    sleep_light_h: Optional[float] = None
    sleep_awake_h: Optional[float] = None


@app.get("/health")
async def health():
    return {"status": "ok", "service": "garmin-sidecar"}


@app.post("/sync", response_model=SyncResponse)
async def sync(req: SyncRequest):
    try:
        from garminconnect import Garmin, GarminConnectAuthenticationError

        client = Garmin(req.garmin_email, req.garmin_password)
        client.login()

        target_date = req.date  # YYYY-MM-DD string

        result = SyncResponse(status="ok", date=target_date)

        # HRV data
        try:
            hrv_data = client.get_hrv_data(target_date)
            if hrv_data:
                summary = hrv_data.get("hrvSummary", {})
                result.hrv_rmssd = summary.get("lastNight")
                result.hrv_status = summary.get("status", "").lower().replace(" ", "_") or None
        except Exception as e:
            logger.warning(f"HRV fetch failed: {e}")

        # Sleep data
        try:
            sleep_data = client.get_sleep_data(target_date)
            if sleep_data:
                daily = sleep_data.get("dailySleepDTO", {})
                total_sec = daily.get("sleepTimeSeconds", 0)
                result.sleep_hours = round(total_sec / 3600, 2) if total_sec else None
                result.sleep_score = daily.get("sleepScores", {}).get("overall", {}).get("value")
                deep_sec = daily.get("deepSleepSeconds", 0)
                rem_sec = daily.get("remSleepSeconds", 0)
                light_sec = daily.get("lightSleepSeconds", 0)
                awake_sec = daily.get("awakeSleepSeconds", 0)
                result.sleep_deep_h = round(deep_sec / 3600, 2) if deep_sec else None
                result.sleep_rem_h = round(rem_sec / 3600, 2) if rem_sec else None
                result.sleep_light_h = round(light_sec / 3600, 2) if light_sec else None
                result.sleep_awake_h = round(awake_sec / 3600, 2) if awake_sec else None
        except Exception as e:
            logger.warning(f"Sleep fetch failed: {e}")

        # Stats (steps, stress, body battery, resting HR)
        try:
            stats = client.get_stats(target_date)
            if stats:
                result.resting_hr = stats.get("restingHeartRate")
                result.steps = stats.get("totalSteps")
                result.calories_active = stats.get("activeKilocalories")
                result.stress_avg = stats.get("averageStressLevel")
                result.body_battery_min = stats.get("minBodyBattery")
                result.body_battery_max = stats.get("maxBodyBattery")
        except Exception as e:
            logger.warning(f"Stats fetch failed: {e}")

        return result

    except Exception as e:
        logger.error(f"Garmin sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
