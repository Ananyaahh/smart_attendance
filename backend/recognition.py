from __future__ import annotations

# Drop-in replacement for InsightFace-based recognition.py
# Uses the `face_recognition` library (dlib) which needs ~80 MB RAM
# vs InsightFace's ~500 MB, making it deployable on free-tier hosting.
#
# ⚠️  Embedding format change: face_recognition produces 128-d vectors
#     (InsightFace produced 512-d). Any students registered with the old
#     backend must be re-registered after this change is deployed.
#
# Matching uses Euclidean distance (lower = more similar).
# Default threshold 0.5 — increase toward 0.6 to be more lenient,
# decrease toward 0.4 to be stricter.

from typing import Any

import cv2
import face_recognition
import numpy as np

from backend.database import get_student_embeddings

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _bgr_to_rgb(frame: np.ndarray) -> np.ndarray:
    """OpenCV uses BGR; face_recognition expects RGB."""
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)


def _resize_for_detection(frame: np.ndarray, max_side: int = 1280) -> tuple[np.ndarray, float]:
    """
    Shrink very large frames to speed up detection while keeping aspect ratio.
    Returns (resized_frame, scale_factor) where scale_factor < 1 means shrunk.
    """
    h, w = frame.shape[:2]
    longest = max(h, w)
    if longest <= max_side:
        return frame, 1.0
    scale = max_side / longest
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return resized, scale


# ---------------------------------------------------------------------------
# Public API — same signatures as the InsightFace version
# ---------------------------------------------------------------------------

def extract_embedding(frame: np.ndarray) -> np.ndarray | None:
    """
    Detect faces in *frame* (BGR numpy array) and return the 128-d embedding
    of the best (largest) face, or None if no face is detected.
    """
    rgb = _bgr_to_rgb(frame)
    small, scale = _resize_for_detection(rgb)

    # Use HOG model (fast, CPU-friendly). Switch to "cnn" for better accuracy
    # if you have a GPU or don't mind slower inference.
    locations = face_recognition.face_locations(small, model="hog")

    # If HOG finds nothing, try upsampling once (helps with small/distant faces).
    if not locations:
        locations = face_recognition.face_locations(small, number_of_times_to_upsample=2, model="hog")

    if not locations:
        return None

    # Scale bounding boxes back to original frame coordinates.
    if scale != 1.0:
        locations = [
            (int(top / scale), int(right / scale), int(bottom / scale), int(left / scale))
            for top, right, bottom, left in locations
        ]
        rgb_full = _bgr_to_rgb(frame)
    else:
        rgb_full = small

    # Pick the largest face (by bounding-box area).
    best_loc = max(
        locations,
        key=lambda loc: (loc[2] - loc[0]) * (loc[1] - loc[3]),
    )

    encodings = face_recognition.face_encodings(rgb_full, [best_loc])
    if not encodings:
        return None

    return np.array(encodings[0], dtype=np.float64)


def find_best_match(
    face_embedding: np.ndarray,
    students: list[tuple[int, int | None, str, str | None, Any]],
    threshold: float = 0.5,
) -> dict[str, Any]:
    """
    Compare *face_embedding* against every student embedding and return the
    closest match if its Euclidean distance is below *threshold*.

    Unlike the InsightFace version (which used cosine similarity where higher
    is better), here **lower distance = better match**.  The returned
    ``confidence`` value is converted to a 0-1 similarity score so the rest
    of the codebase (and the frontend) doesn't need to change.
    """
    best: dict[str, Any] = {
        "student_id": None,
        "class_id": None,
        "name": "Unknown",
        "roll_number": None,
        "confidence": 0.0,
        "matched": False,
    }
    best_distance = float("inf")

    for student_id, class_id, name, roll_number, ref_embedding in students:
        try:
            ref = np.array(ref_embedding, dtype=np.float64)
            distance = float(np.linalg.norm(face_embedding - ref))
        except Exception:
            continue

        if distance < best_distance:
            best_distance = distance
            # Convert distance to a 0-1 similarity score for the frontend.
            # distance=0 → similarity=1.0; distance=threshold → similarity≈0.5
            similarity = max(0.0, 1.0 - distance)
            best = {
                "student_id": student_id,
                "class_id": class_id,
                "name": name,
                "roll_number": roll_number,
                "confidence": round(similarity, 4),
                "matched": distance <= threshold,
            }

    if not best["matched"]:
        best.update({"student_id": None, "class_id": None, "name": "Unknown"})

    return best


def recognize_face(
    frame: np.ndarray,
    class_id: int,
    threshold: float = 0.5,
) -> dict[str, Any]:
    """
    Full pipeline: extract embedding from *frame*, look it up in the database
    for *class_id*, and return match info.
    """
    _unknown = {
        "student_id": None,
        "class_id": None,
        "name": "Unknown",
        "roll_number": None,
        "confidence": 0.0,
        "matched": False,
    }

    face_embedding = extract_embedding(frame)
    if face_embedding is None:
        return _unknown

    students = get_student_embeddings(class_id=class_id)
    if not students:
        return _unknown

    return find_best_match(face_embedding, students, threshold=threshold)
