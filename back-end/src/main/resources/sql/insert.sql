/* =====================================================
   STEP 1: CREATE DATABASE ONLY
   Execute this FIRST in DBeaver
   ===================================================== */

-- Drop database nếu đã tồn tại
IF DB_ID(N'LMS_DB') IS NOT NULL
BEGIN
    ALTER DATABASE LMS_DB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE LMS_DB;
END;

-- Tạo database mới
CREATE DATABASE LMS_DB;

-- VERIFY: Check database đã được tạo
SELECT name, database_id, create_date 
FROM sys.databases 
WHERE name = 'LMS_DB';

/* =====================================================
   STEP 2: CREATE TABLES
   Execute this AFTER Step 1
   IMPORTANT: Đổi connection sang database LMS_DB trước!
   ===================================================== */

USE LMS_DB;

-------------------------------------------------------
-- 1. USERS
-------------------------------------------------------
CREATE TABLE Users (
    user_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name NVARCHAR(100) NOT NULL,
    last_name NVARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('ADMIN','TEACHER','STUDENT')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
    created_at DATETIME2 DEFAULT SYSDATETIME()
);

-------------------------------------------------------
-- 2. STUDENT
-------------------------------------------------------
CREATE TABLE Student (
    student_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    student_code VARCHAR(50) NOT NULL UNIQUE,
    CONSTRAINT FK_Student_User
        FOREIGN KEY (user_id) REFERENCES Users(user_id)
        ON DELETE CASCADE
);

-------------------------------------------------------
-- 3. TEACHER
-------------------------------------------------------
CREATE TABLE Teacher (
    teacher_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    teacher_code VARCHAR(50) NOT NULL UNIQUE,
    department NVARCHAR(100),
    academic_title NVARCHAR(100),
    CONSTRAINT FK_Teacher_User
        FOREIGN KEY (user_id) REFERENCES Users(user_id)
        ON DELETE CASCADE
);

-------------------------------------------------------
-- 4. COURSE
-------------------------------------------------------
CREATE TABLE Course (
    course_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    teacher_id BIGINT NOT NULL,
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('OPEN','CLOSED')),
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    CONSTRAINT FK_Course_Teacher
        FOREIGN KEY (teacher_id) REFERENCES Teacher(teacher_id)
);

-------------------------------------------------------
-- 5. ENROLLMENT
-------------------------------------------------------
CREATE TABLE Enrollment (
    enrollment_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    course_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    joined_at DATETIME2 DEFAULT SYSDATETIME(),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('ACTIVE','REMOVED')),
    CONSTRAINT UQ_Enrollment UNIQUE (course_id, student_id),
    CONSTRAINT FK_Enrollment_Course
        FOREIGN KEY (course_id) REFERENCES Course(course_id)
        ON DELETE CASCADE,
    CONSTRAINT FK_Enrollment_Student
        FOREIGN KEY (student_id) REFERENCES Student(student_id)
);

-------------------------------------------------------
-- 6. LESSON
-------------------------------------------------------
CREATE TABLE Lesson (
    lesson_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    course_id BIGINT NOT NULL,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    CONSTRAINT FK_Lesson_Course
        FOREIGN KEY (course_id) REFERENCES Course(course_id)
        ON DELETE CASCADE
);

-------------------------------------------------------
-- 7. MATERIAL
-------------------------------------------------------
CREATE TABLE Material (
    material_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    lesson_id BIGINT NOT NULL,
    title NVARCHAR(255) NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    uploaded_by BIGINT NOT NULL,
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    CONSTRAINT FK_Material_Lesson
        FOREIGN KEY (lesson_id) REFERENCES Lesson(lesson_id)
        ON DELETE CASCADE,
    CONSTRAINT FK_Material_Teacher
        FOREIGN KEY (uploaded_by) REFERENCES Teacher(teacher_id)
);

-------------------------------------------------------
-- 8. ASSIGNMENT
-------------------------------------------------------
CREATE TABLE Assignment (
    assignment_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    course_id BIGINT NOT NULL,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    deadline DATETIME2 NOT NULL,
    max_score DECIMAL(5,2) NOT NULL CHECK (max_score > 0),
    created_by BIGINT NOT NULL,
    CONSTRAINT FK_Assignment_Course
        FOREIGN KEY (course_id) REFERENCES Course(course_id)
        ON DELETE CASCADE,
    CONSTRAINT FK_Assignment_Teacher
        FOREIGN KEY (created_by) REFERENCES Teacher(teacher_id)
);

-------------------------------------------------------
-- 9. SUBMISSION
-------------------------------------------------------
CREATE TABLE Submission (
    submission_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    assignment_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    score DECIMAL(5,2),
    submitted_at DATETIME2 DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_Submission UNIQUE (assignment_id, student_id),
    CONSTRAINT FK_Submission_Assignment
        FOREIGN KEY (assignment_id) REFERENCES Assignment(assignment_id)
        ON DELETE CASCADE,
    CONSTRAINT FK_Submission_Student
        FOREIGN KEY (student_id) REFERENCES Student(student_id)
);

-------------------------------------------------------
-- 10. ATTENDANCE
-------------------------------------------------------
CREATE TABLE Attendance (
    attendance_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    enrollment_id BIGINT NOT NULL,
    session_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('PRESENT','ABSENT')),
    CONSTRAINT UQ_Attendance UNIQUE (enrollment_id, session_date),
    CONSTRAINT FK_Attendance_Enrollment
        FOREIGN KEY (enrollment_id) REFERENCES Enrollment(enrollment_id)
        ON DELETE CASCADE
);

-------------------------------------------------------
-- 11. ANNOUNCEMENT
-------------------------------------------------------
CREATE TABLE Announcement (
    announcement_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    course_id BIGINT NOT NULL,
    title NVARCHAR(255) NOT NULL,
    content NVARCHAR(MAX) NOT NULL,
    created_by BIGINT NOT NULL,
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    CONSTRAINT FK_Announcement_Course
        FOREIGN KEY (course_id) REFERENCES Course(course_id)
        ON DELETE CASCADE,
    CONSTRAINT FK_Announcement_Teacher
        FOREIGN KEY (created_by) REFERENCES Teacher(teacher_id)
);

-------------------------------------------------------
-- VERIFY: Check all tables created
-------------------------------------------------------
SELECT TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;


/* =====================================================
   STEP 3: INSERT DATA
   Execute this AFTER Step 2
   IMPORTANT: Đảm bảo đang ở database LMS_DB
   ===================================================== */

USE LMS_DB;

-------------------------------------------------------
-- 1. INSERT USERS
-------------------------------------------------------
SET IDENTITY_INSERT Users ON;

INSERT INTO Users (user_id, email, password_hash, first_name, last_name, role)
VALUES
(1, 'admin@lms.com', 'hash', N'Quản trị', N'Hệ thống', 'ADMIN'),
(2, 'gv.an@lms.com', 'hash', N'Nguyễn', N'Văn An', 'TEACHER'),
(3, 'gv.binh@lms.com', 'hash', N'Trần', N'Quang Bình', 'TEACHER'),
(4, 'sv.a@lms.com', 'hash', N'Lê', N'Hoàng Anh', 'STUDENT'),
(5, 'sv.b@lms.com', 'hash', N'Phạm', N'Minh Bình', 'STUDENT'),
(6, 'sv.c@lms.com', 'hash', N'Vũ', N'Thị Cúc', 'STUDENT'),
(7, 'sv.d@lms.com', 'hash', N'Đặng', N'Quốc Dũng', 'STUDENT'),
(8, 'sv.e@lms.com', 'hash', N'Hoàng', N'Ngọc Em', 'STUDENT');

SET IDENTITY_INSERT Users OFF;

-------------------------------------------------------
-- 2. INSERT TEACHER
-------------------------------------------------------
SET IDENTITY_INSERT Teacher ON;

INSERT INTO Teacher (teacher_id, user_id, teacher_code, department, academic_title)
VALUES
(1, 2, 'GV001', N'Công nghệ thông tin', N'Thạc sĩ'),
(2, 3, 'GV002', N'Hệ thống thông tin', N'Tiến sĩ');

SET IDENTITY_INSERT Teacher OFF;

-------------------------------------------------------
-- 3. INSERT STUDENT
-------------------------------------------------------
SET IDENTITY_INSERT Student ON;

INSERT INTO Student (student_id, user_id, student_code)
VALUES
(1, 4, 'SV001'),
(2, 5, 'SV002'),
(3, 6, 'SV003'),
(4, 7, 'SV004'),
(5, 8, 'SV005');

SET IDENTITY_INSERT Student OFF;

-------------------------------------------------------
-- 4. INSERT COURSE
-------------------------------------------------------
SET IDENTITY_INSERT Course ON;

INSERT INTO Course (course_id, teacher_id, name, description, status)
VALUES
(1, 1, N'Hệ điều hành', N'Quản lý tiến trình, bộ nhớ, đồng bộ, deadlock', 'OPEN'),
(2, 1, N'Hệ điều hành nâng cao', N'Phân trang nâng cao, đa lõi, I/O', 'OPEN'),
(3, 2, N'Cơ sở dữ liệu', N'Thiết kế ERD, SQL, Transaction', 'OPEN');

SET IDENTITY_INSERT Course OFF;

-------------------------------------------------------
-- 5. INSERT ENROLLMENT
-------------------------------------------------------
SET IDENTITY_INSERT Enrollment ON;

INSERT INTO Enrollment (enrollment_id, course_id, student_id, status)
VALUES
(1, 1, 1, 'ACTIVE'),
(2, 1, 2, 'ACTIVE'),
(3, 1, 3, 'ACTIVE'),
(4, 2, 2, 'ACTIVE'),
(5, 2, 4, 'ACTIVE'),
(6, 3, 1, 'ACTIVE'),
(7, 3, 5, 'ACTIVE');

SET IDENTITY_INSERT Enrollment OFF;

-------------------------------------------------------
-- 6. INSERT LESSON
-------------------------------------------------------
SET IDENTITY_INSERT Lesson ON;

INSERT INTO Lesson (lesson_id, course_id, title, description)
VALUES
(1, 1, N'Giới thiệu Hệ điều hành', N'Tổng quan về hệ điều hành'),
(2, 1, N'Quản lý tiến trình', N'Tiến trình, luồng, lập lịch CPU'),
(3, 1, N'Quản lý bộ nhớ', N'Phân trang, TLB, bộ nhớ ảo'),
(4, 2, N'Phân trang nâng cao', N'Multi-level paging'),
(5, 2, N'Đồng bộ nâng cao', N'Mutex, Semaphore'),
(6, 3, N'ERD & mô hình quan hệ', N'Thực thể, liên kết'),
(7, 3, N'SQL cơ bản', N'SELECT, JOIN, GROUP BY');

SET IDENTITY_INSERT Lesson OFF;

-------------------------------------------------------
-- 7. INSERT MATERIAL
-------------------------------------------------------
SET IDENTITY_INSERT Material ON;

INSERT INTO Material (material_id, lesson_id, title, file_url, uploaded_by)
VALUES
(1, 1, N'Slide chương 1', '/files/os_ch1.pdf', 1),
(2, 2, N'Slide chương 2', '/files/os_ch2.pdf', 1),
(3, 3, N'Slide chương 3', '/files/os_ch3.pdf', 1),
(4, 4, N'Tài liệu Paging', '/files/paging.pdf', 1),
(5, 6, N'Slide ERD', '/files/erd.pdf', 2),
(6, 7, N'SQL Cheatsheet', '/files/sql.pdf', 2);

SET IDENTITY_INSERT Material OFF;

-------------------------------------------------------
-- 8. INSERT ASSIGNMENT
-------------------------------------------------------
SET IDENTITY_INSERT Assignment ON;

INSERT INTO Assignment (assignment_id, course_id, title, description, deadline, max_score, created_by)
VALUES
(1, 1, N'Bài tập 1: Tiến trình', N'Câu hỏi lý thuyết tiến trình', '2026-02-01', 10, 1),
(2, 1, N'Bài tập 2: Phân trang', N'Tính page, frame, offset', '2026-02-10', 10, 1),
(3, 2, N'Bài tập: Semaphore', N'Đồng bộ Producer-Consumer', '2026-02-15', 10, 1),
(4, 3, N'Bài tập ERD', N'Thiết kế ERD LMS', '2026-02-05', 10, 2);

SET IDENTITY_INSERT Assignment OFF;

-------------------------------------------------------
-- 9. INSERT SUBMISSION
-------------------------------------------------------
SET IDENTITY_INSERT Submission ON;

INSERT INTO Submission (submission_id, assignment_id, student_id, file_url, score)
VALUES
(1, 1, 1, '/submit/sv001_bt1.pdf', 8.5),
(2, 1, 2, '/submit/sv002_bt1.pdf', 9.0),
(3, 2, 1, '/submit/sv001_bt2.pdf', 7.5),
(4, 2, 3, '/submit/sv003_bt2.pdf', 8.0),
(5, 4, 5, '/submit/sv005_erd.pdf', 9.5);

SET IDENTITY_INSERT Submission OFF;

-------------------------------------------------------
-- 10. INSERT ATTENDANCE
-------------------------------------------------------
SET IDENTITY_INSERT Attendance ON;

INSERT INTO Attendance (attendance_id, enrollment_id, session_date, status)
VALUES
(1, 1, '2026-01-05', 'PRESENT'),
(2, 1, '2026-01-12', 'ABSENT'),
(3, 2, '2026-01-05', 'PRESENT'),
(4, 2, '2026-01-12', 'PRESENT'),
(5, 3, '2026-01-05', 'ABSENT'),
(6, 4, '2026-01-08', 'PRESENT'),
(7, 5, '2026-01-08', 'PRESENT');

SET IDENTITY_INSERT Attendance OFF;

-------------------------------------------------------
-- 11. INSERT ANNOUNCEMENT
-------------------------------------------------------
SET IDENTITY_INSERT Announcement ON;

INSERT INTO Announcement (announcement_id, course_id, title, content, created_by)
VALUES
(1, 1, N'Chào mừng sinh viên', N'Chào mừng các bạn đến với môn Hệ điều hành', 1),
(2, 1, N'Nhắc nộp bài tập', N'Nhớ nộp bài tập phân trang đúng hạn', 1),
(3, 3, N'Thông báo bài tập ERD', N'Hạn nộp bài ERD là 05/02', 2);

SET IDENTITY_INSERT Announcement OFF;

-------------------------------------------------------
-- VERIFY: Check data count
-------------------------------------------------------
SELECT 'Users' AS TableName, COUNT(*) AS RecordCount FROM Users
UNION ALL SELECT 'Teacher', COUNT(*) FROM Teacher
UNION ALL SELECT 'Student', COUNT(*) FROM Student
UNION ALL SELECT 'Course', COUNT(*) FROM Course
UNION ALL SELECT 'Enrollment', COUNT(*) FROM Enrollment
UNION ALL SELECT 'Lesson', COUNT(*) FROM Lesson
UNION ALL SELECT 'Material', COUNT(*) FROM Material
UNION ALL SELECT 'Assignment', COUNT(*) FROM Assignment
UNION ALL SELECT 'Submission', COUNT(*) FROM Submission
UNION ALL SELECT 'Attendance', COUNT(*) FROM Attendance
UNION ALL SELECT 'Announcement', COUNT(*) FROM Announcement
ORDER BY TableName;