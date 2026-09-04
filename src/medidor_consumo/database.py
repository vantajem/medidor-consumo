import sqlite3
from pathlib import Path


def initialize_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS samples(
            id             INTEGER PRIMARY KEY,
            recorded_at    TEXT NOT NULL,
            cpu_power_w    REAL NOT NULL,
            gpu_power_w    REAL NOT NULL,
            total_power_w  REAL NOT NULL,
            energy_kwh     REAL NOT NULL,
            cost_brl       REAL NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def save_sample(
    db_path: Path,
    recorded_at: str,
    cpu_power_w: float,
    gpu_power_w: float,
    total_power_w: float,
    energy_kwh: float,
    cost_brl: float,
) -> None:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    try:
        cur.execute(
            """
        INSERT INTO samples (
            recorded_at,
            cpu_power_w,
            gpu_power_w,
            total_power_w,
            energy_kwh,
            cost_brl
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
            (
                recorded_at,
                cpu_power_w,
                gpu_power_w,
                total_power_w,
                energy_kwh,
                cost_brl,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def get_day_totals(db_path: Path, date: str) -> tuple[float, float]:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT COALESCE(SUM(energy_kwh), 0), COALESCE(SUM(cost_brl), 0) FROM samples WHERE recorded_at LIKE ?
        """,
            (f"{date}%",),
        )
        energy_kwh, cost_brl = cur.fetchone()
    finally:
        conn.close()

    return energy_kwh, cost_brl


def get_daily_totals(db_path: Path) -> list[tuple[str, float, float]]:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT
                substr(recorded_at, 1, 10),
                SUM(energy_kwh),
                SUM(cost_brl)
            FROM samples
            GROUP BY substr(recorded_at, 1, 10)
            ORDER BY substr(recorded_at, 1, 10)
        """)
        return cur.fetchall()
    finally:
        conn.close()


def get_latest_power(db_path: Path) -> tuple[str, float, float, float] | None:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT recorded_at, cpu_power_w, gpu_power_w, total_power_w
            FROM samples
            ORDER BY id DESC
            LIMIT 1
        """)
        return cur.fetchone()
    finally:
        conn.close()


def get_power_history(
    db_path: Path, date: str
) -> list[tuple[str, float, float, float, float]]:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    try:
        cur.execute(
            """
            SELECT
                substr(recorded_at, 1, 16),
                AVG(cpu_power_w),
                AVG(gpu_power_w),
                AVG(total_power_w),
                SUM(energy_kwh)
            FROM samples
            WHERE recorded_at LIKE ?
            GROUP BY substr(recorded_at, 1, 16)
            ORDER BY substr(recorded_at, 1, 16)
        """,
            (f"{date}%",),
        )
        return cur.fetchall()
    finally:
        conn.close()
