from __future__ import annotations

from typing import Any

import numpy as np
import cv2

from backend.database import get_student_embeddings

_face_recognition = None


def get_face_recognition():
    global _face_recognition
    if _face_recognition is None:
        import face_recognition
        _face_recognition = face_recognition
    return _face_recognition


def extract_embedding(frame: np.ndarray) -> np.ndarray | None:
    fr = get_face_recognition()
    # Convert BGR (OpenCV) to RGB (face_recognition)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # Try to find face locations
    face_locations = fr.face_locations(rgb_frame, model="hog")
    
    if not face_locations:
        # Try with smaller image if no face found
        small = cv2.resize(rgb_frame, None, fx=0.5, fy=0.5)
        face_locations = fr.face_locations(small, model="hog")
        if not face_locations:
            return None
        # Scale locations back up
        face_locations = [(t*2, r*2, b*2, l*2) for t, r, b, l in face_locations]
    
    # Get face encodings (embeddings)
    encodings = fr.face_encodings(rgb_frame, face_locations)
    
    if not encodings:
        return None
    
    return np.array(encodings[0])


def find_best_match(
    face_embedding: np.ndarray,
    students: list[tuple[int, int | None, str, str | None, Any]],
    threshold: float = 0.6,
) -> dict[str, Any]:
    best: dict[str, Any] = {
        "student_id": None,
        "class_id": None,
        "name": "Unknown",
        "roll_number": None,
        "confidence": 0.0,
        "matched": False,
    }

    for student_id, class_id, name, roll_number, ref_embedding in students:
        # face_recognition uses euclidean distance — convert to similarity
        distance = float(np.linalg.norm(face_embedding - ref_embedding))
        # Convert distance to similarity (lower distance = higher similarity)
        similarity = max(0.0, 1.0 - distance)
        
        if similarity > best["confidence"]:
            # face_recognition threshold: distance < 0.6 is a match
            matched = distance < threshold
            best = {
                "student_id": student_id,
                "class_id": class_id,
                "name": name,
                "roll_number": roll_number,
                "confidence": similarity,
                "matched": matched,
            }

    if not best["matched"]:
        best.update({"student_id": None, "class_id": None, "name": "Unknown"})

    return best


def recognize_face(frame: np.ndarray, class_id: int, threshold: float = 0.6) -> dict[str, Any]:
    face_embedding = extract_embedding(frame)
    if face_embedding is None:
        return {
            "student_id": None,
            "class_id": None,
            "name": "Unknown",
            "roll_number": None,
            "confidence": 0.0,
            "matched": False,
        }

    students = get_student_embeddings(class_id=class_id)
    if not students:
        return {
            "student_id": None,
            "class_id": None,
            "name": "Unknown",
            "roll_number": None,
            "confidence": 0.0,
            "matched": False,
        }

    return find_best_match(face_embedding, students, threshold=threshold)
