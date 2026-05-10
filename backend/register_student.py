import cv2
import sqlite3
import pickle
import numpy as np
from insightface.app import FaceAnalysis
from sklearn.metrics.pairwise import cosine_similarity
import time


app = FaceAnalysis(providers=['CPUExecutionProvider'])
app.prepare(ctx_id=-1, det_size=(640,640))


def load_existing_embeddings():
    conn = sqlite3.connect("attendance.db")
    cursor = conn.cursor()

    cursor.execute("SELECT name, embedding FROM students")

    students = []
    for row in cursor.fetchall():
        name = row[0]
        emb = pickle.loads(row[1])
        students.append((name, emb))

    conn.close()
    return students


def register_student(name, roll_number):

    cap = cv2.VideoCapture(0)

    print("Scanning face for a few seconds...")

    embeddings = []
    start_time = time.time()

    while True:

        ret, frame = cap.read()

        faces = app.get(frame)

        for face in faces:
            embeddings.append(face.embedding)

        cv2.putText(
            frame,
            "Scanning...",
            (30,40),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0,255,0),
            2
        )

        cv2.imshow("Register Student", frame)

        if time.time() - start_time > 3:
            break

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

    if len(embeddings) == 0:
        print("No face detected.")
        return

    avg_embedding = np.mean(embeddings, axis=0)

    students = load_existing_embeddings()

    for existing_name, existing_embedding in students:

        similarity = cosine_similarity(
            avg_embedding.reshape(1,-1),
            existing_embedding.reshape(1,-1)
        )[0][0]

        if similarity > 0.6:
            print(f"Person already registered as {existing_name}")
            return

    conn = sqlite3.connect("attendance.db")
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO students (name, roll_number, embedding) VALUES (?, ?, ?)",
        (name, roll_number, pickle.dumps(avg_embedding))
    )

    conn.commit()
    conn.close()

    print("Student registered successfully")


if __name__ == "__main__":

    name = input("Enter student name: ")
    roll = input("Enter roll number: ")

    register_student(name, roll)
