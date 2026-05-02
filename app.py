from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import json
import base64
import io
from datetime import datetime
import cv2
import numpy as np
from PIL import Image
from database import get_db_connection, init_database
import models

app = Flask(__name__)
CORS(app)

# Initialize database
init_database()

@app.route('/')
def index():
    return render_template('index.html')

# Student routes
@app.route('/api/students', methods=['GET'])
def get_students():
    conn = get_db_connection()
    students = conn.execute('SELECT * FROM students ORDER BY last_name, first_name').fetchall()
    conn.close()
    
    students_list = []
    for student in students:
        student_dict = dict(student)
        # Convert face_encoding to boolean for frontend
        student_dict['face_encoding'] = student_dict['face_encoding'] is not None
        students_list.append(student_dict)
    
    return jsonify({'students': students_list})

@app.route('/api/students', methods=['POST'])
def add_student():
    data = request.get_json()
    student_id = data.get('student_id')
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    email = data.get('email')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            'INSERT INTO students (student_id, first_name, last_name, email) VALUES (?, ?, ?, ?)',
            (student_id, first_name, last_name, email)
        )
        conn.commit()
        new_id = cursor.lastrowid
        
        # Get the newly created student
        new_student = conn.execute(
            'SELECT * FROM students WHERE id = ?', (new_id,)
        ).fetchone()
        conn.close()
        
        student_dict = dict(new_student)
        student_dict['face_encoding'] = student_dict['face_encoding'] is not None
        
        return jsonify(student_dict)
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Student ID already exists'}), 400

@app.route('/api/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    conn = get_db_connection()
    
    # Check if student exists
    student = conn.execute('SELECT * FROM students WHERE id = ?', (student_id,)).fetchone()
    if not student:
        conn.close()
        return jsonify({'error': 'Student not found'}), 404
    
    # Delete related records first
    conn.execute('DELETE FROM attendance_records WHERE student_id = ?', (student_id,))
    conn.execute('DELETE FROM enrollments WHERE student_id = ?', (student_id,))
    
    # Delete the student
    conn.execute('DELETE FROM students WHERE id = ?', (student_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Student deleted successfully'})

# Course routes
@app.route('/api/courses', methods=['GET'])
def get_courses():
    conn = get_db_connection()
    courses = conn.execute('SELECT * FROM courses ORDER BY course_code').fetchall()
    conn.close()
    
    courses_list = [dict(course) for course in courses]
    return jsonify({'courses': courses_list})

@app.route('/api/courses', methods=['POST'])
def add_course():
    data = request.get_json()
    course_code = data.get('course_code')
    course_name = data.get('course_name')
    description = data.get('description')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            'INSERT INTO courses (course_code, course_name, description) VALUES (?, ?, ?)',
            (course_code, course_name, description)
        )
        conn.commit()
        course_id = cursor.lastrowid
        
        # Get the newly created course
        new_course = conn.execute(
            'SELECT * FROM courses WHERE id = ?', (course_id,)
        ).fetchone()
        conn.close()
        
        return jsonify(dict(new_course))
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Course code already exists'}), 400

@app.route('/api/courses/<int:course_id>', methods=['DELETE'])
def delete_course(course_id):
    conn = get_db_connection()
    
    # Check if course exists
    course = conn.execute('SELECT * FROM courses WHERE id = ?', (course_id,)).fetchone()
    if not course:
        conn.close()
        return jsonify({'error': 'Course not found'}), 404
    
    # Delete related records first
    conn.execute('DELETE FROM attendance_records WHERE course_id = ?', (course_id,))
    conn.execute('DELETE FROM enrollments WHERE course_id = ?', (course_id,))
    
    # Delete the course
    conn.execute('DELETE FROM courses WHERE id = ?', (course_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Course deleted successfully'})

# Enrollment routes
@app.route('/api/enrollments', methods=['POST'])
def add_enrollment():
    data = request.get_json()
    student_id = data.get('student_id')
    course_id = data.get('course_id')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            'INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)',
            (student_id, course_id)
        )
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Student enrolled successfully'})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Student is already enrolled in this course'}), 400

# Attendance routes
@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    course_id = request.args.get('course_id')
    date = request.args.get('date')
    
    query = '''
        SELECT ar.*, s.student_id, s.first_name, s.last_name, c.course_code, c.course_name
        FROM attendance_records ar
        JOIN students s ON ar.student_id = s.id
        JOIN courses c ON ar.course_id = c.id
    '''
    params = []
    
    if course_id and date:
        query += ' WHERE ar.course_id = ? AND ar.attendance_date = ?'
        params = [course_id, date]
    elif course_id:
        query += ' WHERE ar.course_id = ?'
        params = [course_id]
    elif date:
        query += ' WHERE ar.attendance_date = ?'
        params = [date]
    
    query += ' ORDER BY ar.attendance_date DESC, s.last_name, s.first_name'
    
    conn = get_db_connection()
    attendance = conn.execute(query, params).fetchall()
    conn.close()
    
    attendance_list = [dict(record) for record in attendance]
    return jsonify({'attendance': attendance_list})

@app.route('/api/attendance', methods=['POST'])
def add_attendance():
    data = request.get_json()
    student_id = data.get('student_id')
    course_id = data.get('course_id')
    attendance_date = data.get('attendance_date')
    status = data.get('status')
    notes = data.get('notes')
    
    conn = get_db_connection()
    
    # Check if record already exists
    existing = conn.execute(
        'SELECT * FROM attendance_records WHERE student_id = ? AND course_id = ? AND attendance_date = ?',
        (student_id, course_id, attendance_date)
    ).fetchone()
    
    if existing:
        # Update existing record
        conn.execute(
            'UPDATE attendance_records SET status = ?, notes = ? WHERE id = ?',
            (status, notes, existing['id'])
        )
        record_id = existing['id']
    else:
        # Insert new record
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO attendance_records (student_id, course_id, attendance_date, status, notes) VALUES (?, ?, ?, ?, ?)',
            (student_id, course_id, attendance_date, status, notes)
        )
        record_id = cursor.lastrowid
    
    conn.commit()
    conn.close()
    
    return jsonify({'id': record_id, 'message': 'Attendance recorded successfully'})

# Face recognition routes
@app.route('/api/recognize', methods=['POST'])
def recognize_faces():
    try:
        # Get the image from the request
        data = request.get_json()
        image_data = data.get('image')
        
        # Remove the data URL prefix
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        # Decode the base64 image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert to numpy array for OpenCV
        image_np = np.array(image)
        # Convert RGB to BGR (OpenCV uses BGR)
        image_np = image_np[:, :, ::-1].copy()
        
        # Load the pre-trained face detection classifier
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Convert to grayscale for face detection
        gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        # Get all students from database
        conn = get_db_connection()
        students = conn.execute('SELECT * FROM students').fetchall()
        conn.close()
        
        recognized_students = []
        
        # For each face detected, "recognize" a student (for demo purposes)
        for i, (x, y, w, h) in enumerate(faces):
            if i < len(students):
                student = dict(students[i])
                # Convert face_encoding to boolean for frontend
                student['face_encoding'] = student['face_encoding'] is not None
                recognized_students.append(student)
        
        return jsonify({'recognized_students': recognized_students})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/register_face', methods=['POST'])
def register_face():
    try:
        data = request.get_json()
        student_id = data.get('student_id')
        image_data = data.get('image')
        
        # Remove the data URL prefix
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        # Decode the base64 image
        image_bytes = base64.b64decode(image_data)
        
        # Update student record with face image
        conn = get_db_connection()
        conn.execute(
            'UPDATE students SET face_encoding = ? WHERE id = ?',
            (image_bytes, student_id)
        )
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Face registered successfully'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Get students for a course
@app.route('/api/courses/<int:course_id>/students', methods=['GET'])
def get_course_students(course_id):
    conn = get_db_connection()
    
    # Get enrolled students for this course
    students = conn.execute('''
        SELECT s.* FROM students s
        JOIN enrollments e ON s.id = e.student_id
        WHERE e.course_id = ?
        ORDER BY s.last_name, s.first_name
    ''', (course_id,)).fetchall()
    
    conn.close()
    
    students_list = []
    for student in students:
        student_dict = dict(student)
        # Convert face_encoding to boolean for frontend
        student_dict['face_encoding'] = student_dict['face_encoding'] is not None
        students_list.append(student_dict)
    
    return jsonify({'students': students_list})

# Get all students for enrollment
@app.route('/api/students/available', methods=['GET'])
def get_available_students():
    course_id = request.args.get('course_id')
    
    conn = get_db_connection()
    
    if course_id:
        # Get students not enrolled in this course
        students = conn.execute('''
            SELECT s.* FROM students s
            WHERE s.id NOT IN (
                SELECT student_id FROM enrollments WHERE course_id = ?
            )
            ORDER BY s.last_name, s.first_name
        ''', (course_id,)).fetchall()
    else:
        # Get all students
        students = conn.execute('SELECT * FROM students ORDER BY last_name, first_name').fetchall()
    
    conn.close()
    
    students_list = []
    for student in students:
        student_dict = dict(student)
        # Convert face_encoding to boolean for frontend
        student_dict['face_encoding'] = student_dict['face_encoding'] is not None
        students_list.append(student_dict)
    
    return jsonify({'students': students_list})

if __name__ == '__main__':
    app.run(debug=True, port=5000)