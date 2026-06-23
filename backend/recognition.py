from __future__ import annotations
from typing import Any
import cv2
import mediapipe as mp
import numpy as np
from backend.database import get_student_embeddings

_face_detector = None

def _get_detector():
    global _face_detector
    if _face_detector is None:
        _face_detector = mp.solutions.face_detection.FaceDetection(
            model_selection=1,
            min_detection_confidence=0.5,
        )
    return _face_detector

_FACE_SIZE = 100

def _extract_face_crop(frame, bbox):
    h, w = frame.shape[:2]
    x_min = max(0, int(bbox.xmin * w))
    y_min = max(0, int(bbox.ymin * h))
    x_max = min(w, int((bbox.xmin + bbox.width) * w))
    y_max = min(h, int((bbox.ymin + bbox.height) * h))
    if x_max <= x_min or y_max <= y_min:
        return None
    pad_x = int((x_max - x_min) * 0.2)
    pad_y = int((y_max - y_min) * 0.2)
    x_min = max(0, x_min - pad_x)
    y_min = max(0, y_min - pad_y)
    x_max = min(w, x_max + pad_x)
    y_max = min(h, y_max + pad_y)
    return frame[y_min:y_max, x_min:x_max]

def _face_to_embedding(face_crop):
    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    resized = cv2.resize(gray, (_FACE_SIZE, _FACE_SIZE))
    cell_size = _FACE_SIZE // 5
    features = []
    for row in range(5):
        for col in range(5):
            cell = resized[row*cell_size:(row+1)*cell_size, col*cell_size:(col+1)*cell_size]
            hist, _ = np.histogram(cell.flatten(), bins=16, range=(0, 256))
            features.extend(hist.tolist())
    vec = np.array(features, dtype=np.float64)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec

def extract_embedding(frame):
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    detector = _get_detector()
    results = detector.process(rgb)
    if not results.detections:
        enhanced = cv2.convertScaleAbs(frame, alpha=1.3, beta=20)
        results = detector.process(cv2.cvtColor(enhanced, cv2.COLOR_BGR2RGB))
        if not results.detections:
            return None
    best = max(results.detections, key=lambda d: d.location_data.relative_bounding_box.width * d.location_data.relative_bounding_box.height)
    face_crop = _extract_face_crop(frame, best.location_data.relative_bounding_box)
    if face_crop is None or face_crop.size == 0:
        return None
    return _face_to_embedding(face_crop)

def find_best_match(face_embedding, students, threshold=0.97):
    best = {"student_id": None, "class_id": None, "name": "Unknown", "roll_number": None, "confidence": 0.0, "matched": False}
    for student_id, class_id, name, roll_number, ref_embedding in students:
        try:
            ref = np.array(ref_embedding, dtype=np.float64)
            similarity = float(np.dot(face_embedding, ref) / (np.linalg.norm(face_embedding) * np.linalg.norm(ref) + 1e-9))
        except Exception:
            continue
        if similarity > best["confidence"]:
            best = {"student_id": student_id, "class_id": class_id, "name": name, "roll_number": roll_number, "confidence": round(similarity, 4), "matched": similarity >= threshold}
    if not best["matched"]:
        best.update({"student_id": None, "class_id": None, "name": "Unknown"})
    return best

def recognize_face(frame, class_id, threshold=0.97):
    _unknown = {"student_id": None, "class_id": None, "name": "Unknown", "roll_number": None, "confidence": 0.0, "matched": False}
    face_embedding = extract_embedding(frame)
    if face_embedding is None:
        return _unknown
    students = get_student_embeddings(class_id=class_id)
    if not students:
        return _unknown
    return find_best_match(face_embedding, students, threshold=threshold)
