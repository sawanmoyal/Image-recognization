"""
app.py — Flask Web Application for Smart Human Activity Recognition.

Routes:
    GET  /              → Dashboard (upload + results)
    POST /analyze       → Upload image → returns JSON with detections
    GET  /events        → JSON event log
    DELETE /events      → Clear event log
    GET  /events/export → CSV download
    GET  /stats         → JSON activity statistics
    GET  /health        → Health check
"""

from __future__ import annotations

import io
import os
import sys
import base64
import logging
from datetime import datetime

import cv2
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, send_file, render_template
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Add project root to path so we can import from src/ and utils/
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))
sys.path.insert(0, os.path.join(ROOT, "utils"))

from activity_detector import ActivityDetector
from helper import (
    log_event,
    save_event_frame,
    read_event_log,
    clear_event_log,
    get_activity_color,
    draw_bounding_box,
    SPECIAL_ACTIVITIES,
    LOG_CSV_PATH,
)

# ── App setup ─────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__, template_folder="templates")
CORS(app)

app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # 20 MB

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "bmp", "webp"}

# Lazy-load the detector (heavy init: MediaPipe + PyTorch)
_detector: ActivityDetector | None = None


def get_detector() -> ActivityDetector:
    global _detector
    if _detector is None:
        logger.info("Initialising ActivityDetector…")
        _detector = ActivityDetector()
    return _detector


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()})


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Accept an image upload, run pose extraction + activity classification,
    annotate the image, log events, and return JSON results.
    """
    if "file" not in request.files:
        return jsonify({"error": "NO_FILE", "message": "No file field in request"}), 400

    file = request.files["file"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"error": "INVALID_FILE", "message": "Upload a valid image (jpg/png/bmp/webp)"}), 400

    try:
        # Read image from upload
        file_bytes = np.frombuffer(file.read(), dtype=np.uint8)
        frame = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if frame is None:
            return jsonify({"error": "DECODE_ERROR", "message": "Could not decode image"}), 400

        detector = get_detector()
        results = detector.process(frame)

        events_saved = 0
        detections = []

        annotated = frame.copy()

        if results:
            for det in results:
                color = get_activity_color(det.activity)
                b = det.bbox
                annotated = draw_bounding_box(
                    annotated,
                    b["x"], b["y"], b["width"], b["height"],
                    det.activity, det.confidence, color,
                )

                # Log every detection
                frame_path = None
                if det.activity in SPECIAL_ACTIVITIES:
                    frame_path = save_event_frame(annotated, det.activity, det.person_id)
                    events_saved += 1

                log_event(det.activity, det.confidence, det.person_id, frame_path)

                detections.append({
                    "personId": det.person_id,
                    "activity": det.activity,
                    "confidence": round(det.confidence, 4),
                    "poseConfidence": round(det.pose_confidence, 4),
                    "bbox": det.bbox,
                })
        else:
            # No person detected
            detections = []

        # Encode annotated image as base64 PNG
        _, buffer = cv2.imencode(".png", annotated)
        img_b64 = base64.b64encode(buffer).decode("utf-8")
        processed_image_url = f"data:image/png;base64,{img_b64}"

        return jsonify({
            "detections": detections,
            "processedImageUrl": processed_image_url,
            "frameTimestamp": datetime.utcnow().isoformat(),
            "eventsSaved": events_saved,
            "personsDetected": len(detections),
        })

    except Exception as e:
        logger.exception("Analysis failed")
        return jsonify({"error": "ANALYSIS_FAILED", "message": str(e)}), 500


@app.route("/events", methods=["GET"])
def list_events():
    """Return logged events as JSON, with optional activity filter."""
    activity_filter = request.args.get("activity")
    limit = int(request.args.get("limit", 100))

    events = read_event_log()

    if activity_filter:
        events = [e for e in events if e.get("activity") == activity_filter]

    events = events[:limit]

    return jsonify({
        "events": events,
        "total": len(read_event_log()),
    })


@app.route("/events", methods=["DELETE"])
def delete_events():
    """Clear all logged events."""
    clear_event_log()
    return jsonify({"success": True, "message": "All events cleared"})


@app.route("/events/export", methods=["GET"])
def export_events():
    """Stream the event log as a CSV file download."""
    if not os.path.exists(LOG_CSV_PATH):
        # Return empty CSV
        output = io.StringIO("timestamp,activity,confidence,person_id,frame_path\n")
    else:
        with open(LOG_CSV_PATH) as f:
            output = io.StringIO(f.read())

    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"activity_events_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv",
    )


@app.route("/stats", methods=["GET"])
def stats():
    """Return aggregate statistics about detected activities."""
    events = read_event_log()
    total = len(events)

    if not events:
        return jsonify({
            "totalDetections": 0,
            "activityBreakdown": [],
            "specialEventsCount": 0,
        })

    df = pd.DataFrame(events)
    df["confidence"] = pd.to_numeric(df["confidence"], errors="coerce")

    breakdown = (
        df.groupby("activity")
        .agg(count=("activity", "count"), avgConfidence=("confidence", "mean"))
        .reset_index()
        .sort_values("count", ascending=False)
        .to_dict(orient="records")
    )

    special_count = df[df["activity"].isin(SPECIAL_ACTIVITIES)].shape[0]

    return jsonify({
        "totalDetections": total,
        "activityBreakdown": [
            {
                "activity": r["activity"],
                "count": int(r["count"]),
                "avgConfidence": round(float(r["avgConfidence"]), 3),
            }
            for r in breakdown
        ],
        "specialEventsCount": int(special_count),
    })


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info("Starting Smart Human Activity Recognition server on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=False)
