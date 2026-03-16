"""
activity_detector.py — Real-time human activity detection pipeline.

This module combines:
1. MediaPipe pose extraction (pose_extraction.py)
2. PyTorch MLP classifier (if trained model exists)
3. Rule-based heuristic fallback (using joint angles when no model is available)

The detector accepts a BGR frame and returns a list of DetectionResult objects,
one per detected person, each containing the activity label, confidence,
bounding box, and annotated frame.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

import numpy as np
import torch
import torch.nn.functional as F

from pose_extraction import PoseExtractor, PoseResult, FEATURE_DIM
from train_model import ActivityClassifierMLP, ACTIVITY_LABELS, LABEL_TO_IDX, NUM_CLASSES

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "activity_classifier.pth")


# ── Result type ───────────────────────────────────────────────────────────────

@dataclass
class DetectionResult:
    """Holds the output of activity detection for one person."""
    person_id: int
    activity: str
    confidence: float
    bbox: dict          # {x, y, width, height}
    pose_confidence: float
    annotated_frame: np.ndarray


# ── Rule-based heuristic classifier ──────────────────────────────────────────

def heuristic_classify(pose: PoseResult) -> tuple[str, float]:
    """
    Classify activity using joint angle heuristics.
    Used as fallback when no trained PyTorch model is available.

    Returns:
        (activity_label, confidence)
    """
    angles = PoseExtractor.keypoint_angles(pose.keypoints)
    kps = pose.keypoints

    left_knee = angles["left_knee"]
    right_knee = angles["right_knee"]
    left_hip = angles["left_hip"]
    right_hip = angles["right_hip"]
    torso_lean = angles["torso_lean"]
    left_elbow = angles["left_elbow"]
    right_elbow = angles["right_elbow"]

    # Wrist positions relative to head
    nose_y = kps[0, 1]
    left_wrist_y = kps[15, 1]
    right_wrist_y = kps[16, 1]

    # Hip height relative to shoulder
    left_hip_y = kps[23, 1]
    left_shoulder_y = kps[11, 1]
    hip_to_shoulder = left_hip_y - left_shoulder_y

    # ── Decision rules ────────────────────────────────────────────────────

    # FALLING: person nearly horizontal (torso very tilted, hips near head level)
    if torso_lean < 40 or hip_to_shoulder < 0.05:
        return "falling", 0.88

    # SITTING: knees deeply bent, hips low
    avg_knee = (left_knee + right_knee) / 2
    if avg_knee < 110 and (left_hip + right_hip) / 2 < 120:
        return "sitting", 0.84

    # FIGHTING: arms raised wide, high elbow angles
    if left_elbow > 160 and right_elbow > 160 and torso_lean > 70:
        return "fighting", 0.79

    # USING PHONE: one wrist raised above nose
    if left_wrist_y < nose_y - 0.05 or right_wrist_y < nose_y - 0.05:
        return "using_phone", 0.76

    # RUNNING: knees bent, alternating, torso forward
    if avg_knee < 150 and torso_lean < 70:
        return "running", 0.72

    # Default: walking
    return "walking", 0.70


# ── Neural network classifier ─────────────────────────────────────────────────

class NeuralClassifier:
    """Loads and runs the trained PyTorch MLP classifier."""

    def __init__(self, model_path: str = MODEL_PATH) -> None:
        self.device = torch.device("cpu")
        self.model: Optional[ActivityClassifierMLP] = None
        self.labels = ACTIVITY_LABELS

        if os.path.exists(model_path):
            try:
                checkpoint = torch.load(model_path, map_location=self.device)
                self.model = ActivityClassifierMLP().to(self.device)
                self.model.load_state_dict(checkpoint["model_state_dict"])
                self.model.eval()
                self.labels = checkpoint.get("labels", ACTIVITY_LABELS)
                logger.info("Loaded trained model from %s", model_path)
            except Exception as e:
                logger.warning("Failed to load model (%s) — using heuristics.", e)
                self.model = None
        else:
            logger.info("No trained model found at %s — using heuristic classifier.", model_path)

    def predict(self, feature_vector: np.ndarray) -> tuple[str, float]:
        """
        Predict activity from a pose feature vector.

        Args:
            feature_vector: np.ndarray of shape (FEATURE_DIM,)

        Returns:
            (activity_label, confidence)
        """
        if self.model is None:
            return "walking", 0.70  # should not be called without pose result

        x = torch.tensor(feature_vector, dtype=torch.float32).unsqueeze(0).to(self.device)
        with torch.no_grad():
            logits = self.model(x)
            probs = F.softmax(logits, dim=1).squeeze()

        idx = int(probs.argmax().item())
        confidence = float(probs[idx].item())
        label = self.labels[idx] if idx < len(self.labels) else "unknown"
        return label, confidence


# ── Main Detector ─────────────────────────────────────────────────────────────

class ActivityDetector:
    """
    Full pipeline: pose extraction → classification → annotation.

    Usage:
        detector = ActivityDetector()
        results = detector.process(frame)
        for r in results:
            print(r.activity, r.confidence)
        detector.close()
    """

    def __init__(self) -> None:
        self.pose_extractor = PoseExtractor(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.classifier = NeuralClassifier()
        logger.info("ActivityDetector ready.")

    def process(self, frame: np.ndarray, person_id: int = 1) -> list[DetectionResult]:
        """
        Process a single BGR frame.

        Args:
            frame:     BGR image array from OpenCV.
            person_id: Person identifier (for multi-person tracking).

        Returns:
            List of DetectionResult (one per detected person).
        """
        pose = self.pose_extractor.extract(frame)
        if pose is None:
            return []

        # Choose classifier
        if self.classifier.model is not None:
            activity, confidence = self.classifier.predict(pose.feature_vector)
        else:
            activity, confidence = heuristic_classify(pose)

        return [DetectionResult(
            person_id=person_id,
            activity=activity,
            confidence=confidence,
            bbox=pose.bbox,
            pose_confidence=pose.confidence,
            annotated_frame=pose.annotated_frame,
        )]

    def close(self) -> None:
        self.pose_extractor.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
