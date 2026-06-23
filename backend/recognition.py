from __future__ import annotations
from typing import Any
import cv2
import numpy as np
from backend.database import get_student_embeddings

_face_cascade = None

def _get_detector():
    global _face_cascade
    if _face_cascade is None:
        _face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    return _face_cascade

_FACE_SIZE = 100

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
    detector = _get_detector()
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    if len(faces) == 0:
        enhanced = cv2.convertScaleAbs(frame, alpha=1.3, beta=20)
        gray2 = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)
        faces = detector.detectMultiScale(gray2, scaleFactor=1.1, minNeighbors=3, minSize=(20, 20))
        if len(faces) == 0:
            return None
    x, y, w, h = max(faces, key=lambda f: f[2]*f[3])
    pad_x, pad_y = int(w*0.2), int(h*0.2)
    x1 = max(0, x-pad_x); y1 = max(0, y-pad_y)
    x2 = min(frame.shape[1], x+w+pad_x); y2 = min(frame.shape[0], y+h+pad_y)
    face_crop = frame[y1:y2, x1:x2]
    if face_crop.size == 0:
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
