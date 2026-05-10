from __future__ import annotations

from typing import Any

import numpy as np
from insightface.app import FaceAnalysis
from sklearn.metrics.pairwise import cosine_similarity

from backend.database import get_student_embeddings

_face_app = None


def get_face_app() -> FaceAnalysis:
    global _face_app
    if _face_app is None:
        app = FaceAnalysis(providers=["CPUExecutionProvider"])
        app.prepare(ctx_id=-1, det_size=(960, 960))
        _face_app = app
    return _face_app


def _detect_faces(frame: np.ndarray) -> list[Any]:
    app = get_face_app()
    faces = app.get(frame)
    if faces:
        return faces

    height, width = frame.shape[:2]
    longest_side = max(height, width)
    if longest_side < 1200:
        scale = min(2.0, 1200 / float(longest_side))
        enlarged = np.ascontiguousarray(frame)
        if scale > 1.05:
            import cv2

            enlarged = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        faces = app.get(enlarged)
        if faces:
            return faces

    return []


def extract_embedding(frame: np.ndarray) -> np.ndarray | None:
    faces = _detect_faces(frame)
    if not faces:
        return None
    best_face = max(
        faces,
        key=lambda face: float(face.det_score) * max(1.0, float((face.bbox[2] - face.bbox[0]) * (face.bbox[3] - face.bbox[1]))),
    )
    return best_face.embedding


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
        similarity = cosine_similarity(
            face_embedding.reshape(1, -1),
            ref_embedding.reshape(1, -1),
        )[0][0]
        if similarity > best["confidence"]:
            best = {
                "student_id": student_id,
                "class_id": class_id,
                "name": name,
                "roll_number": roll_number,
                "confidence": float(similarity),
                "matched": similarity >= threshold,
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
