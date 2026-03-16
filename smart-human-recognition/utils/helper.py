"""
helper.py — Shared utility functions for the Smart Human Recognition System.

Provides:
- CSV event logging
- Frame saving for special events
- Confidence formatting
- Color maps for activities
"""

import csv
import os
import time
import logging
from datetime import datetime
from typing import Optional

import cv2
import numpy as np

# ─── Configuration ────────────────────────────────────────────────────────────

SAVED_EVENTS_DIR = os.path.join(os.path.dirname(__file__), "..", "saved_events")
LOG_CSV_PATH = os.path.join(SAVED_EVENTS_DIR, "event_log.csv")

CSV_HEADERS = ["timestamp", "activity", "confidence", "person_id", "frame_path"]

# Activities considered high-risk → always saved
SPECIAL_ACTIVITIES = {"falling", "fighting"}

# BGR color palette per activity (for OpenCV drawing)
ACTIVITY_COLORS = {
    "walking":     (235, 130, 59),   # blue-orange
    "sitting":     (86, 197, 34),    # green
    "running":     (50, 205, 235),   # yellow-ish
    "falling":     (40,  40, 239),   # red
    "using_phone": (30, 165, 249),   # orange
    "fighting":    (10,  10, 180),   # dark red
}

DEFAULT_COLOR = (255, 255, 255)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def ensure_dirs() -> None:
    """Create necessary output directories if they don't exist."""
    os.makedirs(SAVED_EVENTS_DIR, exist_ok=True)


def get_activity_color(activity: str) -> tuple:
    """Return BGR color tuple for a given activity label."""
    return ACTIVITY_COLORS.get(activity, DEFAULT_COLOR)


def format_confidence(confidence: float) -> str:
    """Format confidence as a percentage string."""
    return f"{confidence * 100:.1f}%"


def log_event(
    activity: str,
    confidence: float,
    person_id: int = 0,
    frame_path: Optional[str] = None,
) -> None:
    """
    Append a detection event to the CSV event log.

    Args:
        activity:    Activity label string.
        confidence:  Confidence score [0, 1].
        person_id:   Index of the detected person in the frame.
        frame_path:  Optional path to saved frame image.
    """
    ensure_dirs()
    write_header = not os.path.exists(LOG_CSV_PATH)

    with open(LOG_CSV_PATH, "a", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=CSV_HEADERS)
        if write_header:
            writer.writeheader()
        writer.writerow({
            "timestamp": datetime.utcnow().isoformat(),
            "activity": activity,
            "confidence": round(confidence, 4),
            "person_id": person_id,
            "frame_path": frame_path or "",
        })

    logger.info("Event logged: [person %d] %s (%.1f%%)", person_id, activity, confidence * 100)


def save_event_frame(frame: np.ndarray, activity: str, person_id: int = 0) -> str:
    """
    Save a frame image when a special activity is detected.

    Args:
        frame:      OpenCV BGR image array.
        activity:   Activity label (used in filename).
        person_id:  Person index in the frame.

    Returns:
        Path to the saved image file.
    """
    ensure_dirs()
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"{activity}_person{person_id}_{timestamp}.jpg"
    filepath = os.path.join(SAVED_EVENTS_DIR, filename)
    cv2.imwrite(filepath, frame)
    logger.info("Special event frame saved: %s", filepath)
    return filepath


def read_event_log() -> list[dict]:
    """
    Read all events from the CSV log.

    Returns:
        List of event dicts, newest first.
    """
    ensure_dirs()
    if not os.path.exists(LOG_CSV_PATH):
        return []

    with open(LOG_CSV_PATH, newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        events = list(reader)

    return list(reversed(events))


def clear_event_log() -> None:
    """Delete the CSV event log file."""
    if os.path.exists(LOG_CSV_PATH):
        os.remove(LOG_CSV_PATH)
        logger.info("Event log cleared.")


def draw_bounding_box(
    frame: np.ndarray,
    x: int,
    y: int,
    w: int,
    h: int,
    label: str,
    confidence: float,
    color: tuple,
) -> np.ndarray:
    """
    Draw a bounding box with activity label and confidence on a frame.

    Args:
        frame:      OpenCV BGR image.
        x, y, w, h: Bounding box coordinates.
        label:      Activity label.
        confidence: Confidence score [0, 1].
        color:      BGR tuple.

    Returns:
        Annotated frame.
    """
    thickness = 2
    cv2.rectangle(frame, (x, y), (x + w, y + h), color, thickness)

    # Label background
    text = f"{label.replace('_', ' ').title()} {format_confidence(confidence)}"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.55
    (text_w, text_h), baseline = cv2.getTextSize(text, font, font_scale, 1)
    label_y = max(y - 8, text_h + 4)
    cv2.rectangle(frame, (x, label_y - text_h - 4), (x + text_w + 4, label_y + baseline), color, -1)
    cv2.putText(frame, text, (x + 2, label_y - 2), font, font_scale, (255, 255, 255), 1, cv2.LINE_AA)

    return frame
