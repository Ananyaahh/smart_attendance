from __future__ import annotations

import base64
import os
import smtplib
from datetime import datetime
from email.message import EmailMessage

import cv2
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.database import (
    create_class,
    create_faculty,
    create_google_faculty,
    create_tables,
    delete_student,
    get_attendance,
    get_attendance_days,
    get_attendance_stats,
    get_classes,
    get_faculty_by_email,
    get_faculty_by_google_sub,
    get_reports,
    get_student_embeddings,
    get_students,
    insert_student,
    link_google_account,
    mark_welcome_email_sent,
    mark_attendance,
    upsert_report_file,
    verify_faculty,
)
from backend.recognition import extract_embedding, find_best_match, recognize_face

load_dotenv()


class LoginPayload(BaseModel):
    email: str
    password: str
    auto_create: bool = True


class SignupPayload(BaseModel):
    name: str
    email: str
    password: str


class GoogleAuthPayload(BaseModel):
    credential: str


class ClassPayload(BaseModel):
    faculty_id: int
    class_name: str
    section: str
    semester: str = ""


class ImagePayload(BaseModel):
    class_id: int
    image_base64: str


class RegisterPayload(ImagePayload):
    name: str
    roll_number: str


app = FastAPI(title="Smart Attendance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    create_tables()


@app.get("/")
def home() -> dict[str, str]:
    return {"message": "Smart Attendance API Running"}


def send_welcome_email(recipient_email: str, recipient_name: str) -> bool:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL")

    if not all([smtp_host, smtp_port, smtp_username, smtp_password, smtp_from_email]):
        return False

    message = EmailMessage()
    message["Subject"] = "Welcome to Smart Attendance"
    message["From"] = smtp_from_email
    message["To"] = recipient_email
    message.set_content(
        f"Hi {recipient_name},\n\nThank you for using Smart Attendance. Your faculty account is ready.\n"
    )

    with smtplib.SMTP(smtp_host, int(smtp_port)) as server:
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(message)

    return True


def verify_google_credential(credential: str) -> dict:
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not google_client_id:
        raise HTTPException(status_code=500, detail="Google sign-in is not configured on the server")

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="google-auth is not installed on the server") from exc

    try:
        token_info = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            google_client_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid Google credential") from exc

    if token_info.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=401, detail="Invalid Google issuer")

    email = token_info.get("email")
    google_sub = token_info.get("sub")
    if not email or not google_sub:
        raise HTTPException(status_code=400, detail="Google account payload is incomplete")

    return token_info


@app.post("/auth/login")
def login(payload: LoginPayload) -> dict:
    email = payload.email.strip().lower()
    password = payload.password
    faculty = verify_faculty(email, password)
    if not faculty:
        existing = get_faculty_by_email(email)
        if existing and not payload.auto_create:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        if existing and payload.auto_create:
            raise HTTPException(status_code=401, detail="Invalid password for this email")
        if payload.auto_create:
            display_name = email.split("@", 1)[0].replace(".", " ").replace("_", " ").title() or "Faculty"
            create_faculty(display_name, email, password)
            faculty = verify_faculty(email, password)
        if not faculty:
            raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"success": True, "faculty": faculty}


@app.post("/auth/signup")
def signup(payload: SignupPayload) -> dict:
    try:
        faculty_id = create_faculty(
            name=payload.name.strip(),
            email=payload.email.strip().lower(),
            password=payload.password,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Signup failed: {exc}") from exc
    return {"success": True, "faculty_id": faculty_id}


@app.post("/auth/google")
def google_auth(payload: GoogleAuthPayload) -> dict:
    token_info = verify_google_credential(payload.credential)

    email = token_info["email"].strip().lower()
    google_sub = token_info["sub"]
    display_name = (token_info.get("name") or email.split("@", 1)[0]).strip()

    faculty = get_faculty_by_google_sub(google_sub)
    created_now = False

    if not faculty:
        existing = get_faculty_by_email(email)
        if existing:
            link_google_account(existing["id"], google_sub)
            faculty = get_faculty_by_email(email)
        else:
            create_google_faculty(display_name, email, google_sub)
            faculty = get_faculty_by_google_sub(google_sub)
            created_now = True

    if not faculty:
        raise HTTPException(status_code=500, detail="Unable to complete Google sign-in")

    welcome_email_sent = bool(faculty.get("welcome_email_sent"))
    welcome_email_triggered = False

    if created_now and not welcome_email_sent:
        try:
            welcome_email_triggered = send_welcome_email(email, display_name)
            if welcome_email_triggered:
                mark_welcome_email_sent(faculty["id"])
        except Exception:
            welcome_email_triggered = False

    return {
        "success": True,
        "faculty": {
            "id": faculty["id"],
            "name": faculty["name"],
            "email": faculty["email"],
        },
        "welcome_email_sent": welcome_email_triggered,
    }


@app.get("/classes")
def list_classes(faculty_id: int = Query(...)) -> list[dict]:
    return get_classes(faculty_id)


@app.post("/classes")
def add_class(payload: ClassPayload) -> dict:
    if not payload.class_name.strip() or not payload.section.strip():
        raise HTTPException(status_code=400, detail="Class name and section are required")

    try:
        class_id = create_class(
            faculty_id=payload.faculty_id,
            class_name=payload.class_name.strip(),
            section=payload.section.strip(),
            semester=payload.semester.strip(),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Class creation failed: {exc}") from exc

    return {"success": True, "class_id": class_id}


@app.get("/classes/{class_id}/students")
def list_students(class_id: int) -> list[dict]:
    return get_students(class_id)


@app.delete("/students/{student_id}")
def remove_student(student_id: int) -> dict[str, bool]:
    if not delete_student(student_id):
        raise HTTPException(status_code=404, detail="Student not found")
    return {"success": True}


@app.get("/classes/{class_id}/attendance")
def class_attendance(class_id: int, date: str | None = Query(default=None)) -> list[dict]:
    return get_attendance(class_id=class_id, attendance_date=date)


@app.get("/classes/{class_id}/attendance/stats")
def attendance_stats(class_id: int, date: str | None = Query(default=None)) -> dict:
    target_date = date or datetime.now().date().isoformat()
    return get_attendance_stats(class_id, target_date)


@app.get("/classes/{class_id}/attendance/days")
def attendance_days(class_id: int) -> dict:
    return {"days": get_attendance_days(class_id)}


def decode_base64_image(image_base64: str) -> np.ndarray:
    try:
        payload = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        image_bytes = base64.b64decode(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image payload") from exc

    npimg = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image")
    return frame


@app.post("/recognize")
def recognize(payload: ImagePayload) -> dict:
    frame = decode_base64_image(payload.image_base64)

    try:
        # Slightly lower threshold to improve practical recognition for webcam conditions.
        result = recognize_face(frame, class_id=payload.class_id, threshold=0.5)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Recognition engine unavailable: {exc}") from exc

    attendance_marked = False
    if result["student_id"] is not None:
        attendance_marked = mark_attendance(payload.class_id, result["student_id"])

    stats = get_attendance_stats(payload.class_id, datetime.now().date().isoformat())

    return {
        "name": result["name"],
        "student_id": result["student_id"],
        "confidence": round(float(result["confidence"]), 4),
        "attendance_marked": attendance_marked,
        "stats": stats,
    }


@app.post("/register")
def register(payload: RegisterPayload) -> dict:
    clean_name = payload.name.strip()
    clean_roll = payload.roll_number.strip()
    if not clean_name or not clean_roll:
        raise HTTPException(status_code=400, detail="Name and roll number are required")

    frame = decode_base64_image(payload.image_base64)

    try:
        embedding = extract_embedding(frame)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Recognition engine unavailable: {exc}") from exc

    if embedding is None:
        raise HTTPException(status_code=400, detail="No face detected in image")

    # First: duplicate check in selected class only.
    class_students = get_student_embeddings(class_id=payload.class_id)
    duplicate_in_class = find_best_match(embedding, class_students, threshold=0.62)
    if duplicate_in_class["student_id"] is not None:
        return {
            "id": duplicate_in_class["student_id"],
            "name": duplicate_in_class["name"],
            "roll_number": duplicate_in_class.get("roll_number") or clean_roll,
            "class_id": payload.class_id,
            "success": True,
            "status": "already_in_class",
            "message": f"Face already registered in this class as {duplicate_in_class['name']}",
        }

    # Second: global duplicate check. If found in another class, map to current class.
    all_students = get_student_embeddings(class_id=None)
    duplicate_anywhere = find_best_match(embedding, all_students, threshold=0.68)

    try:
        student_id = insert_student(payload.class_id, clean_name, clean_roll, embedding)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Registration failed: {exc}") from exc

    if duplicate_anywhere["student_id"] is not None:
        return {
            "id": student_id,
            "name": clean_name,
            "roll_number": clean_roll,
            "class_id": payload.class_id,
            "success": True,
            "status": "mapped_from_existing",
            "message": (
                f"Face matched existing profile ({duplicate_anywhere['name']}) and was mapped to this class successfully"
            ),
        }

    return {
        "id": student_id,
        "name": clean_name,
        "roll_number": clean_roll,
        "class_id": payload.class_id,
        "success": True,
        "status": "created",
        "message": "Student registered successfully",
    }


@app.post("/classes/{class_id}/report")
def generate_report(class_id: int, date: str | None = Query(default=None)) -> dict:
    target_date = date or datetime.now().date().isoformat()
    file_path = upsert_report_file(class_id, target_date)
    return {
        "success": True,
        "date": target_date,
        "file_name": file_path.name,
        "download_url": f"/classes/{class_id}/report/download?date={target_date}",
    }


@app.get("/classes/{class_id}/reports")
def class_reports(class_id: int) -> list[dict]:
    return get_reports(class_id)


@app.get("/classes/{class_id}/report/download")
def download_report(class_id: int, date: str | None = Query(default=None)) -> FileResponse:
    target_date = date or datetime.now().date().isoformat()
    file_path = upsert_report_file(class_id, target_date)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Report not found")
    return FileResponse(file_path, media_type="text/csv", filename=file_path.name)
