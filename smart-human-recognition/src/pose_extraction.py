"""
pose_extraction.py — Human pose keypoint extraction using MediaPipe Pose.

This module wraps MediaPipe's Pose solution to extract 33 body landmark
coordinates from an image or video frame. The keypoints are normalized
to [0, 1] by MediaPipe and then flattened into a 1D feature vector that
can be fed directly into the activity classifier.

Landmark indices (MediaPipe Pose):
    0  = nose
    11 = left shoulder   12 = right shoulder
    13 = left elbow      14 = right elbow
    15 = left wrist      16 = right wrist
    23 = left hip        24 = right hip
    25 = left knee       26 = right knee
    27 = left ankle      28 = right ankle
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np

logger = logging.getLogger(__name__)

# Number of landmarks × (x, y, z, visibility)
NUM_LANDMARKS = 33
FEATURE_DIM = NUM_LANDMARKS * 4  # 132 features per person


@dataclass
class PoseResult:
    """Container for a single-person pose extraction result."""
    keypoints: np.ndarray          # shape (NUM_LANDMARKS, 4) — [x, y, z, visibility]
    feature_vector: np.ndarray     # shape (FEATURE_DIM,) — flattened
    bbox: dict                     # {x, y, width, height} in pixel coords
    confidence: float              # pose detection confidence
    annotated_frame: np.ndarray    # frame with skeleton drawn


class PoseExtractor:
    """
    Wraps MediaPipe Pose for landmark extraction.

    Usage:
        extractor = PoseExtractor()
        results = extractor.extract(frame)  # list[PoseResult]
        extractor.close()

    The extractor processes one person at a time (MediaPipe single-pose mode).
    For multi-person scenarios, use PoseExtractor with multiple crops.
    """

    def __init__(self, min_detection_confidence: float = 0.5,
                 min_tracking_confidence: float = 0.5) -> None:
        self._mp_pose = mp.solutions.pose
        self._mp_draw = mp.solutions.drawing_utils
        self._mp_styles = mp.solutions.drawing_styles

        self.pose = self._mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            enable_segmentation=False,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        logger.info("PoseExtractor initialised (MediaPipe Pose).")

    # ── Public API ──────────────────────────────────────────────────────────

    def extract(self, frame: np.ndarray) -> Optional[PoseResult]:
        """
        Extract pose landmarks from a BGR frame.

        Args:
            frame: OpenCV BGR image array.

        Returns:
            PoseResult if a person is detected, else None.
        """
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_result = self.pose.process(rgb)

        if not mp_result.pose_landmarks:
            return None

        landmarks = mp_result.pose_landmarks.landmark

        # Build (NUM_LANDMARKS, 4) array: [x, y, z, visibility]
        kps = np.array(
            [[lm.x, lm.y, lm.z, lm.visibility] for lm in landmarks],
            dtype=np.float32,
        )

        feature_vector = kps.flatten()  # shape (132,)

        # Estimate bounding box from visible landmarks
        xs = [lm.x * w for lm in landmarks if lm.visibility > 0.3]
        ys = [lm.y * h for lm in landmarks if lm.visibility > 0.3]
        if xs and ys:
            x1, x2 = int(min(xs)), int(max(xs))
            y1, y2 = int(min(ys)), int(max(ys))
            padding = 20
            bbox = {
                "x": max(0, x1 - padding),
                "y": max(0, y1 - padding),
                "width": min(w, x2 + padding) - max(0, x1 - padding),
                "height": min(h, y2 + padding) - max(0, y1 - padding),
            }
        else:
            bbox = {"x": 0, "y": 0, "width": w, "height": h}

        # Pose detection confidence (average of landmark visibilities)
        confidence = float(np.mean([lm.visibility for lm in landmarks]))

        # Draw skeleton on a copy of the frame
        annotated = frame.copy()
        self._mp_draw.draw_landmarks(
            annotated,
            mp_result.pose_landmarks,
            self._mp_pose.POSE_CONNECTIONS,
            landmark_drawing_spec=self._mp_styles.get_default_pose_landmarks_style(),
        )

        return PoseResult(
            keypoints=kps,
            feature_vector=feature_vector,
            bbox=bbox,
            confidence=confidence,
            annotated_frame=annotated,
        )

    def close(self) -> None:
        """Release MediaPipe resources."""
        self.pose.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    # ── Static helpers ───────────────────────────────────────────────────────

    @staticmethod
    def keypoint_angles(kps: np.ndarray) -> dict[str, float]:
        """
        Compute joint angles useful for rule-based classification.

        Args:
            kps: (33, 4) landmark array.

        Returns:
            Dict of angle names → degrees.
        """
        def angle(a, b, c) -> float:
            """Angle at joint b between vectors ba and bc."""
            ba = kps[a, :2] - kps[b, :2]
            bc = kps[c, :2] - kps[b, :2]
            cos_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
            return float(np.degrees(np.arccos(np.clip(cos_angle, -1, 1))))

        return {
            "left_elbow":  angle(11, 13, 15),
            "right_elbow": angle(12, 14, 16),
            "left_knee":   angle(23, 25, 27),
            "right_knee":  angle(24, 26, 28),
            "left_hip":    angle(11, 23, 25),
            "right_hip":   angle(12, 24, 26),
            "torso_lean":  angle(0, 11, 23),   # nose → l-shoulder → l-hip
        }
