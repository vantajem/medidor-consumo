from datetime import date, datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .database import (
    get_daily_totals,
    get_day_totals,
    get_latest_power,
    get_power_history,
    initialize_db,
)

app = FastAPI()

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "consum.db"
FRONTEND_DIST = ROOT / "frontend" / "dist"

initialize_db(DB_PATH)


@app.get("/api/summary")
def _summary() -> dict[str, str | float]:
    today = date.today().isoformat()
    energy_kwh, cost_brl = get_day_totals(DB_PATH, today)

    return {
        "date": today,
        "energy_kwh": round(energy_kwh, 6),
        "cost_brl": round(cost_brl, 6),
    }


@app.get("/api/live")
def _live() -> dict[str, str | float] | None:
    item = get_latest_power(DB_PATH)

    if item is None:
        return None

    return {
        "recorded_at": item[0],
        "cpu_power_w": round(item[1], 2),
        "gpu_power_w": round(item[2], 2),
        "total_power_w": round(item[3], 2),
    }


@app.get("/api/power/today")
def _power_today() -> list[dict[str, str | float]]:
    today = datetime.now().astimezone().date().isoformat()
    items = get_power_history(DB_PATH, today)

    return [
        {
            "recorded_at": item[0],
            "cpu_power_w": round(item[1], 2),
            "gpu_power_w": round(item[2], 2),
            "total_power_w": round(item[3], 2),
            "energy_kwh": round(item[4], 8),
        }
        for item in items
    ]


@app.get("/api/daily")
def _daily() -> list[dict[str, str | float]]:
    items = get_daily_totals(DB_PATH)

    return [
        {
            "date": item[0],
            "energy_kwh": round(item[1], 6),
            "cost_brl": round(item[2], 6),
        }
        for item in items
    ]


@app.get("/api/health")
def _health() -> dict[str, str]:
    return {"status": "ok"}


app.mount(
    "/",
    StaticFiles(directory=FRONTEND_DIST, html=True, check_dir=False),
    name="frontend",
)
