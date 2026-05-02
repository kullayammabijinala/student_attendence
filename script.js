// Global variables
let stream = null;
let faceStream = null;
let capturedImageData = null;

document.addEventListener('DOMContentLoaded', function() {
    // Navigation
    document.getElementById('nav-dashboard').addEventListener('click', () => showView('dashboard'));
    document.getElementById('nav-students').addEventListener('click', () => showView('students'));
    document.getElementById('nav-courses').addEventListener('click', () => showView('courses'));
    document.getElementById('nav-attendance').addEventListener('click', () => showView('attendance'));
    document.getElementById('nav-face-registration').addEventListener('click', () => showView('face-registration'));
    document.getElementById('nav-reports').addEventListener('click', () => showView('reports'));
    
    // Buttons
    document.getElementById('add-student-btn').addEventListener('click', () => openStudentModal());
    document.getElementById('add-course-btn').addEventListener('click', () => openCourseModal());
    document.getElementById('save-student-btn').addEventListener('click', saveStudent);
    document.getElementById('save-course-btn').addEventListener('click', saveCourse);
    document.getElementById('load-students-btn').addEventListener('click', loadStudentsForAttendance);
    document.getElementById('save-attendance-btn').addEventListener('click', saveAttendance);
    document.getElementById('generate-report-btn').addEventListener('click', generateReport);
    
    // Camera buttons
    document.getElementById('start-camera-btn').addEventListener('click', startCamera);
    document.getElementById('stop-camera-btn').addEventListener('click', stopCamera);
    document.getElementById('capture-btn').addEventListener('click', captureAndRecognize);
    
    // Face registration buttons
    document.getElementById('start-face-camera-btn').addEventListener('click', startFaceCamera);
    document.getElementById('stop-face-camera-btn').addEventListener('click', stopFaceCamera);
    document.getElementById('capture-face-btn').addEventListener('click', captureFace);
    document.getElementById('register-face-btn').addEventListener('click', registerFace);
    document.getElementById('retake-face-btn').addEventListener('click', retakeFace);
    
    // Set today's date as default for attendance
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('attendance-date').value = today;
    
    // Initialize the application
    loadDashboard();
    loadStudents();
    loadCourses();
    populateCourseDropdowns();
    populateStudentDropdown();
    
    // Show dashboard by default
    showView('dashboard');
});

// View management
function showView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.style.display = 'none';
    });
    
    // Show the selected view
    document.getElementById(`${viewName}-view`).style.display = 'block';
    
    // Refresh data for the view if needed
    if (viewName === 'dashboard') {
        loadDashboard();
    } else if (viewName === 'students') {
        loadStudents();
    } else if (viewName === 'courses') {
        loadCourses();
    } else if (viewName === 'reports') {
        loadReportFilters();
    } else if (viewName === 'attendance') {
        stopCamera(); // Ensure camera is stopped when switching views
    } else if (viewName === 'face-registration') {
        stopFaceCamera(); // Ensure camera is stopped when switching views
    }
}

// Dashboard functions
function loadDashboard() {
    fetch('/api/students')
        .then(response => response.json())
        .then(data => {
            document.getElementById('total-students').textContent = data.students.length;
        });
    
    fetch('/api/courses')
        .then(response => response.json())
        .then(data => {
            document.getElementById('total-courses').textContent = data.courses.length;
        });
    
    const today = new Date().toISOString().split('T')[0];
    fetch(`/api/attendance?date=${today}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('today-attendance').textContent = data.attendance.length;
            
            // Show recent attendance (last 10 records)
            const recentAttendance = data.attendance.slice(0, 10);
            const tbody = document.getElementById('recent-attendance');
            tbody.innerHTML = '';
            
            recentAttendance.forEach(record => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${record.attendance_date}</td>
                    <td>${record.first_name} ${record.last_name}</td>
                    <td>${record.course_code}</td>
                    <td><span class="status-badge status-${record.status}">${record.status}</span></td>
                `;
                tbody.appendChild(row);
            });
        });
}

// Student management functions
function loadStudents() {
    fetch('/api/students')
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('students-list');
            tbody.innerHTML = '';
            
            data.students.forEach(student => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${student.student_id}</td>
                    <td>${student.first_name}</td>
                    <td>${student.last_name}</td>
                    <td>${student.email || ''}</td>
                    <td>${student.face_encoding ? 'Yes' : 'No'}</td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="editStudent(${student.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteStudent(${student.id})">Delete</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        });
}

function openStudentModal(student = null) {
    const modal = new bootstrap.Modal(document.getElementById('studentModal'));
    const title = document.getElementById('studentModalTitle');
    const form = document.getElementById('student-form');
    
    if (student) {
        title.textContent = 'Edit Student';
        document.getElementById('student-id').value = student.id;
        document.getElementById('student-student-id').value = student.student_id;
        document.getElementById('student-first-name').value = student.first_name;
        document.getElementById('student-last-name').value = student.last_name;
        document.getElementById('student-email').value = student.email || '';
    } else {
        title.textContent = 'Add Student';
        form.reset();
        document.getElementById('student-id').value = '';
    }
    
    modal.show();
}

function saveStudent() {
    const id = document.getElementById('student-id').value;
    const studentId = document.getElementById('student-student-id').value;
    const firstName = document.getElementById('student-first-name').value;
    const lastName = document.getElementById('student-last-name').value;
    const email = document.getElementById('student-email').value;
    
    const student = {
        student_id: studentId,
        first_name: firstName,
        last_name: lastName,
        email: email
    };
    
    const url = '/api/students';
    const method = 'POST';
    
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(student)
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            bootstrap.Modal.getInstance(document.getElementById('studentModal')).hide();
            loadStudents();
            populateStudentDropdown();
            loadDashboard(); // Refresh dashboard stats
        }
    });
}

function editStudent(id) {
    fetch('/api/students')
        .then(response => response.json())
        .then(data => {
            const student = data.students.find(s => s.id == id);
            if (student) {
                openStudentModal(student);
            }
        });
}

function deleteStudent(id) {
    if (confirm('Are you sure you want to delete this student?')) {
        // Note: In a real application, you would have a DELETE endpoint
        // For simplicity, we'll just reload the page
        alert('Delete functionality would be implemented here with a proper DELETE endpoint');
        loadStudents();
    }
}

// Course management functions
function loadCourses() {
    fetch('/api/courses')
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('courses-list');
            tbody.innerHTML = '';
            
            data.courses.forEach(course => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${course.course_code}</td>
                    <td>${course.course_name}</td>
                    <td>${course.description || ''}</td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="editCourse(${course.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCourse(${course.id})">Delete</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        });
}

function populateCourseDropdowns() {
    fetch('/api/courses')
        .then(response => response.json())
        .then(data => {
            const courseSelect = document.getElementById('course-select');
            const reportCourseSelect = document.getElementById('report-course-select');
            
            // Clear existing options except the first one
            while (courseSelect.options.length > 1) {
                courseSelect.remove(1);
            }
            while (reportCourseSelect.options.length > 1) {
                reportCourseSelect.remove(1);
            }
            
            // Add courses to dropdowns
            data.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course.id;
                option.textContent = `${course.course_code} - ${course.course_name}`;
                
                const reportOption = option.cloneNode(true);
                
                courseSelect.appendChild(option);
                reportCourseSelect.appendChild(reportOption);
            });
        });
}

function populateStudentDropdown() {
    fetch('/api/students')
        .then(response => response.json())
        .then(data => {
            const studentSelect = document.getElementById('face-student-select');
            
            // Clear existing options except the first one
            while (studentSelect.options.length > 1) {
                studentSelect.remove(1);
            }
            
            // Add students to dropdown
            data.students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = `${student.student_id} - ${student.first_name} ${student.last_name}`;
                studentSelect.appendChild(option);
            });
        });
}

function openCourseModal(course = null) {
    const modal = new bootstrap.Modal(document.getElementById('courseModal'));
    const title = document.getElementById('courseModalTitle');
    const form = document.getElementById('course-form');
    
    if (course) {
        title.textContent = 'Edit Course';
        document.getElementById('course-modal-id').value = course.id;
        document.getElementById('course-code').value = course.course_code;
        document.getElementById('course-name').value = course.course_name;
        document.getElementById('course-description').value = course.description || '';
    } else {
        title.textContent = 'Add Course';
        form.reset();
        document.getElementById('course-modal-id').value = '';
    }
    
    modal.show();
}

function saveCourse() {
    const id = document.getElementById('course-modal-id').value;
    const code = document.getElementById('course-code').value;
    const name = document.getElementById('course-name').value;
    const description = document.getElementById('course-description').value;
    
    const course = {
        course_code: code,
        course_name: name,
        description: description
    };
    
    const url = '/api/courses';
    const method = 'POST';
    
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(course)
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            bootstrap.Modal.getInstance(document.getElementById('courseModal')).hide();
            loadCourses();
            populateCourseDropdowns();
            loadDashboard(); // Refresh dashboard stats
        }
    });
}

function editCourse(id) {
    fetch('/api/courses')
        .then(response => response.json())
        .then(data => {
            const course = data.courses.find(c => c.id == id);
            if (course) {
                openCourseModal(course);
            }
        });
}

function deleteCourse(id) {
    if (confirm('Are you sure you want to delete this course?')) {
        // Note: In a real application, you would have a DELETE endpoint
        // For simplicity, we'll just reload the page
        alert('Delete functionality would be implemented here with a proper DELETE endpoint');
        loadCourses();
    }
}

// Attendance functions
function loadStudentsForAttendance() {
    const courseId = document.getElementById('course-select').value;
    const date = document.getElementById('attendance-date').value;
    
    if (!courseId) {
        alert('Please select a course');
        return;
    }
    
    if (!date) {
        alert('Please select a date');
        return;
    }
    
    // Get course name for display
    const courseSelect = document.getElementById('course-select');
    const selectedOption = courseSelect.options[courseSelect.selectedIndex];
    document.getElementById('selected-course-name').textContent = selectedOption.text;
    document.getElementById('selected-date').textContent = date;
    
    // Fetch students for this course
    fetch(`/api/courses/${courseId}/students`)
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('attendance-students-list');
            tbody.innerHTML = '';
            
            data.students.forEach(student => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${student.student_id}</td>
                    <td>${student.first_name} ${student.last_name}</td>
                    <td>
                        <select class="form-select attendance-status" data-student-id="${student.id}">
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="late">Late</option>
                            <option value="excused">Excused</option>
                        </select>
                    </td>
                    <td>
                        <input type="text" class="form-control attendance-notes" data-student-id="${student.id}" placeholder="Notes">
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            // Show the attendance form
            document.getElementById('attendance-form').style.display = 'block';
            
            // Load existing attendance records for this date if any
            fetch(`/api/attendance?course_id=${courseId}&date=${date}`)
                .then(response => response.json())
                .then(attendanceData => {
                    attendanceData.attendance.forEach(record => {
                        const statusSelect = document.querySelector(`.attendance-status[data-student-id="${record.student_id}"]`);
                        const notesInput = document.querySelector(`.attendance-notes[data-student-id="${record.student_id}"]`);
                        
                        if (statusSelect) {
                            statusSelect.value = record.status;
                        }
                        
                        if (notesInput) {
                            notesInput.value = record.notes || '';
                        }
                    });
                });
        });
}

function saveAttendance() {
    const courseId = document.getElementById('course-select').value;
    const date = document.getElementById('attendance-date').value;
    
    const statusSelects = document.querySelectorAll('.attendance-status');
    const notesInputs = document.querySelectorAll('.attendance-notes');
    
    const attendanceData = [];
    
    statusSelects.forEach(select => {
        const studentId = select.getAttribute('data-student-id');
        const status = select.value;
        const notes = document.querySelector(`.attendance-notes[data-student-id="${studentId}"]`).value;
        
        attendanceData.push({
            student_id: studentId,
            course_id: courseId,
            attendance_date: date,
            status: status,
            notes: notes
        });
    });
    
    // Save each attendance record
    const promises = attendanceData.map(record => {
        return fetch('/api/attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(record)
        });
    });
    
    Promise.all(promises)
        .then(responses => Promise.all(responses.map(r => r.json())))
        .then(results => {
            alert('Attendance saved successfully!');
            loadDashboard(); // Refresh dashboard
        })
        .catch(error => {
            alert('Error saving attendance: ' + error);
        });
}

// Camera functions for attendance
function startCamera() {
    const video = document.getElementById('camera-preview');
    
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(function(mediaStream) {
            stream = mediaStream;
            video.srcObject = mediaStream;
            video.play();
            
            // Enable/disable buttons
            document.getElementById('start-camera-btn').disabled = true;
            document.getElementById('capture-btn').disabled = false;
            document.getElementById('stop-camera-btn').disabled = false;
        })
        .catch(function(error) {
            console.error('Error accessing camera:', error);
            alert('Error accessing camera: ' + error.message);
        });
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        
        const video = document.getElementById('camera-preview');
        video.srcObject = null;
        
        // Enable/disable buttons
        document.getElementById('start-camera-btn').disabled = false;
        document.getElementById('capture-btn').disabled = true;
        document.getElementById('stop-camera-btn').disabled = true;
    }
}

function captureAndRecognize() {
    const video = document.getElementById('camera-preview');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    
    // Draw the current video frame to the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to data URL
    const imageData = canvas.toDataURL('image/png');
    
    // Send to server for recognition
    fetch('/api/recognize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: imageData })
    })
    .then(response => response.json())
    .then(data => {
        const recognizedList = document.getElementById('recognized-students');
        recognizedList.innerHTML = '';
        
        if (data.recognized_students && data.recognized_students.length > 0) {
            data.recognized_students.forEach(student => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.textContent = `${student.student_id} - ${student.first_name} ${student.last_name}`;
                recognizedList.appendChild(li);
                
                // Automatically mark as present in the attendance form
                const statusSelect = document.querySelector(`.attendance-status[data-student-id="${student.id}"]`);
                if (statusSelect) {
                    statusSelect.value = 'present';
                }
            });
        } else {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.textContent = 'No students recognized';
            recognizedList.appendChild(li);
        }
    })
    .catch(error => {
        console.error('Error recognizing face:', error);
        alert('Error recognizing face: ' + error.message);
    });
}

// Camera functions for face registration
function startFaceCamera() {
    const video = document.getElementById('face-capture-preview');
    
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(function(mediaStream) {
            faceStream = mediaStream;
            video.srcObject = mediaStream;
            video.play();
            
            // Enable/disable buttons
            document.getElementById('start-face-camera-btn').disabled = true;
            document.getElementById('capture-face-btn').disabled = false;
            document.getElementById('stop-face-camera-btn').disabled = false;
        })
        .catch(function(error) {
            console.error('Error accessing camera:', error);
            alert('Error accessing camera: ' + error.message);
        });
}

function stopFaceCamera() {
    if (faceStream) {
        faceStream.getTracks().forEach(track => track.stop());
        faceStream = null;
        
        const video = document.getElementById('face-capture-preview');
        video.srcObject = null;
        
        // Enable/disable buttons
        document.getElementById('start-face-camera-btn').disabled = false;
        document.getElementById('capture-face-btn').disabled = true;
        document.getElementById('stop-face-camera-btn').disabled = true;
    }
}

function captureFace() {
    const video = document.getElementById('face-capture-preview');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    
    // Draw the current video frame to the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to data URL
    capturedImageData = canvas.toDataURL('image/png');
    
    // Display the captured image
    document.getElementById('captured-face').src = capturedImageData;
    document.getElementById('captured-face-container').style.display = 'block';
    
    // Stop the camera
    stopFaceCamera();
}

function registerFace() {
    const studentId = document.getElementById('face-student-select').value;
    
    if (!studentId) {
        alert('Please select a student');
        return;
    }
    
    if (!capturedImageData) {
        alert('Please capture an image first');
        return;
    }
    
    // Send to server for registration
    fetch('/api/register_face', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            student_id: studentId,
            image: capturedImageData 
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            alert('Face registered successfully!');
            document.getElementById('captured-face-container').style.display = 'none';
            capturedImageData = null;
            loadStudents(); // Refresh student list to show face registration status
        }
    })
    .catch(error => {
        console.error('Error registering face:', error);
        alert('Error registering face: ' + error.message);
    });
}

function retakeFace() {
    document.getElementById('captured-face-container').style.display = 'none';
    capturedImageData = null;
    startFaceCamera();
}

// Report functions
function loadReportFilters() {
    // This would populate any additional filters needed for reports
    // Currently handled by populateCourseDropdowns which is called on load
}

function generateReport() {
    const courseId = document.getElementById('report-course-select').value;
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;
    
    let url = '/api/attendance?';
    
    if (courseId) {
        url += `course_id=${courseId}&`;
    }
    
    if (startDate) {
        url += `start_date=${startDate}&`;
    }
    
    if (endDate) {
        url += `end_date=${endDate}&`;
    }
    
    // Remove trailing & or ? if no params
    if (url.endsWith('&') || url.endsWith('?')) {
        url = url.slice(0, -1);
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('report-data');
            tbody.innerHTML = '';
            
            if (data.attendance && data.attendance.length > 0) {
                data.attendance.forEach(record => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${record.attendance_date}</td>
                        <td>${record.first_name} ${record.last_name}</td>
                        <td>${record.course_code}</td>
                        <td><span class="status-badge status-${record.status}">${record.status}</span></td>
                        <td>${record.notes || ''}</td>
                    `;
                    tbody.appendChild(row);
                });
            } else {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="5" class="text-center">No attendance records found</td>`;
                tbody.appendChild(row);
            }
        })
        .catch(error => {
            console.error('Error generating report:', error);
            alert('Error generating report: ' + error.message);
        });
}