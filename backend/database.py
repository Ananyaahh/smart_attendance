from __future__ import annotations

import csv
import os
import pickle
import sqlite3

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_DIR = Path(os.getenv("DB_DIR", str(ROOT_DIR)))
DB_NAME = DB_DIR / "attendance.db"
REPORT_DIR = ROOT_DIR / "reports"
REPORT_DIR.mkdir(exist_ok=True)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_NAME, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA busy_timeout=30000;")
    return conn


def _column_exists(cursor: sqlite3.Cursor, table_name: str, column_name: str) -> bool:
    rows = cursor.execute(f"PRAGMA table_info({table_name})").fetchall()
    return any(row[1] == column_name for row in rows)


def create_tables() -> None:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS faculty (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            auth_provider TEXT NOT NULL DEFAULT 'local',
            google_sub TEXT UNIQUE,
            welcome_email_sent INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    )

    if not _column_exists(cursor, "faculty", "auth_provider"):
        cursor.execute("ALTER TABLE faculty ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'local'")
    if not _column_exists(cursor, "faculty", "google_sub"):
        cursor.execute("ALTER TABLE faculty ADD COLUMN google_sub TEXT")
    if not _column_exists(cursor, "faculty", "welcome_email_sent"):
        cursor.execute("ALTER TABLE faculty ADD COLUMN welcome_email_sent INTEGER NOT NULL DEFAULT 0")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            faculty_id INTEGER NOT NULL,
            class_name TEXT NOT NULL,
            section TEXT NOT NULL,
            semester TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(faculty_id, class_name, section, semester),
            FOREIGN KEY(faculty_id) REFERENCES faculty(id)
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_id INTEGER,
            name TEXT NOT NULL,
            roll_number TEXT,
            embedding BLOB NOT NULL,
            created_at TEXT,
            FOREIGN KEY(class_id) REFERENCES classes(id)
        )
        """
    )

    if not _column_exists(cursor, "students", "class_id"):
        cursor.execute("ALTER TABLE students ADD COLUMN class_id INTEGER")
    if not _column_exists(cursor, "students", "created_at"):
        cursor.execute("ALTER TABLE students ADD COLUMN created_at TEXT")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_id INTEGER,
            student_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            FOREIGN KEY(class_id) REFERENCES classes(id),
            FOREIGN KEY(student_id) REFERENCES students(id)
        )
        """
    )

    if not _column_exists(cursor, "attendance", "class_id"):
        cursor.execute("ALTER TABLE attendance ADD COLUMN class_id INTEGER")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_id INTEGER NOT NULL,
            report_date TEXT NOT NULL,
            file_path TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(class_id) REFERENCES classes(id)
        )
        """
    )

    # Seed demo faculty account for first run.
    existing = cursor.execute("SELECT id FROM faculty WHERE email = ?", ("teacher@smart.local",)).fetchone()
    if not existing:
        cursor.execute(
            "INSERT INTO faculty (name, email, password, created_at) VALUES (?, ?, ?, ?)",
            ("Default Teacher", "teacher@smart.local", "teacher123", datetime.now().isoformat()),
        )

    conn.commit()
    conn.close()


def verify_faculty(email: str, password: str) -> dict[str, Any] | None:
    conn = get_connection()
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT id, name, email FROM faculty WHERE email = ? AND password = ?",
        (email, password),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_faculty_by_email(email: str) -> dict[str, Any] | None:
    conn = get_connection()
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT id, name, email FROM faculty WHERE email = ?",
        (email,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_faculty_by_google_sub(google_sub: str) -> dict[str, Any] | None:
    conn = get_connection()
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT id, name, email, auth_provider, google_sub, welcome_email_sent FROM faculty WHERE google_sub = ?",
        (google_sub,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def create_faculty(name: str, email: str, password: str) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO faculty (name, email, password, created_at) VALUES (?, ?, ?, ?)",
        (name, email, password, datetime.now().isoformat()),
    )
    faculty_id = int(cursor.lastrowid)
    conn.commit()
    conn.close()
    return faculty_id


def create_google_faculty(name: str, email: str, google_sub: str) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO faculty (name, email, password, auth_provider, google_sub, welcome_email_sent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (name, email, "", "google", google_sub, 0, datetime.now().isoformat()),
    )
    faculty_id = int(cursor.lastrowid)
    conn.commit()
    conn.close()
    return faculty_id


def link_google_account(faculty_id: int, google_sub: str) -> None:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE faculty
        SET auth_provider = 'google', google_sub = ?
        WHERE id = ?
        """,
        (google_sub, faculty_id),
    )
    conn.commit()
    conn.close()


def mark_welcome_email_sent(faculty_id: int) -> None:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE faculty SET welcome_email_sent = 1 WHERE id = ?",
        (faculty_id,),
    )
    conn.commit()
    conn.close()


def get_classes(faculty_id: int) -> list[dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    rows = cursor.execute(
        """
        SELECT id, class_name, section, semester, created_at
        FROM classes
        WHERE faculty_id = ?
        ORDER BY class_name, section
        """,
        (faculty_id,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def create_class(faculty_id: int, class_name: str, section: str, semester: str) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO classes (faculty_id, class_name, section, semester, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (faculty_id, class_name, section, semester, datetime.now().isoformat()),
    )
    class_id = int(cursor.lastrowid)
    conn.commit()
    conn.close()
    return class_id


def get_students(class_id: int) -> list[dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    rows = cursor.execute(
        "SELECT id, class_id, name, roll_number, created_at FROM students WHERE class_id = ? ORDER BY name",
        (class_id,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_student_embeddings(class_id: int | None = None) -> list[tuple[int, int | None, str, str | None, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    if class_id is None:
        rows = cursor.execute(
            "SELECT id, class_id, name, roll_number, embedding FROM students"
        ).fetchall()
    else:
        rows = cursor.execute(
            "SELECT id, class_id, name, roll_number, embedding FROM students WHERE class_id = ?",
            (class_id,),
        ).fetchall()
    conn.close()
    return [
        (row["id"], row["class_id"], row["name"], row["roll_number"], pickle.loads(row["embedding"]))
        for row in rows
    ]


def insert_student(class_id: int, name: str, roll_number: str, embedding: Any) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO students (class_id, name, roll_number, embedding, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (class_id, name, roll_number, pickle.dumps(embedding), datetime.now().isoformat()),
    )
    student_id = int(cursor.lastrowid)
    conn.commit()
    conn.close()
    return student_id


def delete_student(student_id: int) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM attendance WHERE student_id = ?", (student_id,))
    deleted = cursor.execute("DELETE FROM students WHERE id = ?", (student_id,)).rowcount
    conn.commit()
    conn.close()
    return deleted > 0


def mark_attendance(class_id: int, student_id: int) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now()
    today = now.date().isoformat()
    current_time = now.strftime("%H:%M:%S")

    existing = cursor.execute(
        "SELECT id FROM attendance WHERE class_id = ? AND student_id = ? AND date = ?",
        (class_id, student_id, today),
    ).fetchone()
    if existing:
        conn.close()
        return False

    cursor.execute(
        "INSERT INTO attendance (class_id, student_id, date, time) VALUES (?, ?, ?, ?)",
        (class_id, student_id, today, current_time),
    )
    conn.commit()
    conn.close()
    return True


def get_attendance(class_id: int, attendance_date: str | None = None) -> list[dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    query = """
        SELECT a.id, a.class_id, a.student_id, s.name, s.roll_number, a.date, a.time
        FROM attendance a
        JOIN students s ON s.id = a.student_id
        WHERE a.class_id = ?
    """
    params: list[Any] = [class_id]
    if attendance_date:
        query += " AND a.date = ?"
        params.append(attendance_date)
    query += " ORDER BY a.time DESC"
    rows = cursor.execute(query, tuple(params)).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_attendance_stats(class_id: int, attendance_date: str) -> dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()

    total_strength = cursor.execute(
        "SELECT COUNT(*) AS c FROM students WHERE class_id = ?",
        (class_id,),
    ).fetchone()["c"]

    present_count = cursor.execute(
        "SELECT COUNT(*) AS c FROM attendance WHERE class_id = ? AND date = ?",
        (class_id, attendance_date),
    ).fetchone()["c"]

    conn.close()
    absent_count = max(0, total_strength - present_count)
    return {
        "date": attendance_date,
        "class_id": class_id,
        "total_strength": total_strength,
        "present": present_count,
        "absent": absent_count,
    }


def get_attendance_days(class_id: int) -> list[str]:
    conn = get_connection()
    cursor = conn.cursor()
    rows = cursor.execute(
        "SELECT DISTINCT date FROM attendance WHERE class_id = ? ORDER BY date DESC",
        (class_id,),
    ).fetchall()
    conn.close()
    return [row["date"] for row in rows]


def upsert_report_file(class_id: int, report_date: str) -> Path:
    file_name = f"class_{class_id}_{report_date}.csv"
    file_path = REPORT_DIR / file_name

    rows = get_attendance(class_id=class_id, attendance_date=report_date)

    with file_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(["student_id", "name", "roll_number", "date", "time"])
        for row in rows:
            writer.writerow([row["student_id"], row["name"], row["roll_number"] or "", row["date"], row["time"]])

    conn = get_connection()
    cursor = conn.cursor()
    existing = cursor.execute(
        "SELECT id FROM reports WHERE class_id = ? AND report_date = ?",
        (class_id, report_date),
    ).fetchone()

    if existing:
        cursor.execute(
            "UPDATE reports SET file_path = ?, created_at = ? WHERE id = ?",
            (str(file_path), datetime.now().isoformat(), existing["id"]),
        )
    else:
        cursor.execute(
            "INSERT INTO reports (class_id, report_date, file_path, created_at) VALUES (?, ?, ?, ?)",
            (class_id, report_date, str(file_path), datetime.now().isoformat()),
        )

    conn.commit()
    conn.close()
    return file_path


def get_reports(class_id: int) -> list[dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    rows = cursor.execute(
        "SELECT id, class_id, report_date, file_path, created_at FROM reports WHERE class_id = ? ORDER BY report_date DESC",
        (class_id,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]
