-- 4.1.1 Stored Procedure

-- SP1: Đăng ký khóa học cho học viên
-- Bảng Enrollments (id, student_id, course_id, status)
CREATE PROCEDURE RegisterCourse(
    IN p_student_id INT,
    IN p_course_id INT
)
BEGIN
    INSERT INTO Enrollments (student_id, course_id, status)
    VALUES (p_student_id, p_course_id, 'Registered');
END;

-- SP2: Cập nhật trạng thái đăng ký
-- Bảng Enrollments (id, student_id, course_id, status)
CREATE PROCEDURE UpdateRegistrationStatus(
    IN p_registration_id INT,
    IN p_new_status VARCHAR(50)
)
BEGIN
    UPDATE Enrollments
    SET status = p_new_status
    WHERE id = p_registration_id;
END;

-- SP3: Ghi nhận điểm danh buổi học
-- Bảng Attendance (id, student_id, session_id, attended, date)
CREATE PROCEDURE RecordAttendance(
    IN p_student_id INT,
    IN p_session_id INT
)
BEGIN
    INSERT INTO Attendance (student_id, session_id, attended, date)
    VALUES (p_student_id, p_session_id, 1, NOW());
END;

-- SP4: Nộp bài tập và lưu lịch sử nộp
-- Bảng Submissions (id, student_id, assignment_id, file_path, submitted_at)
-- Bảng SubmissionHistory (id, submission_id, event, timestamp)
CREATE PROCEDURE SubmitAssignment(
    IN p_student_id INT,
    IN p_assignment_id INT,
    IN p_file_path VARCHAR(255)
)
BEGIN
    INSERT INTO Submissions (student_id, assignment_id, file_path, submitted_at)
    VALUES (p_student_id, p_assignment_id, p_file_path, NOW());
    -- Giả sử SubmissionHistory ghi lại sự kiện nộp bài
    INSERT INTO SubmissionHistory (submission_id, event, timestamp)
    VALUES (LAST_INSERT_ID(), 'Submitted', NOW());
END;


-- SP5: Cập nhật tiến độ học tập của học viên trong khóa
-- Bảng CourseProgress (student_id, course_id, progress)
CREATE PROCEDURE UpdateProgress(
    IN p_student_id INT,
    IN p_course_id INT,
    IN p_new_progress FLOAT
)
BEGIN
    UPDATE CourseProgress
    SET progress = p_new_progress
    WHERE student_id = p_student_id
      AND course_id = p_course_id;
END;



-----------------------------------------------------------------------------------------------------------------------------------------------




-- 4.1.2 Trigger

-- T1: Trigger mã hóa mật khẩu trước khi insert/update User

-- Bảng Users (id, username, password)
CREATE TRIGGER encrypt_password_before_insert
BEFORE INSERT ON Users
FOR EACH ROW
BEGIN
    SET NEW.password = MD5(NEW.password);
END;

CREATE TRIGGER encrypt_password_before_update
BEFORE UPDATE ON Users
FOR EACH ROW
BEGIN
    SET NEW.password = MD5(NEW.password);
END;


-- T2: Trigger kiểm tra không cho đăng ký trùng khóa học

-- Bảng Enrollments (student_id, course_id)
CREATE TRIGGER no_duplicate_registration
BEFORE INSERT ON Enrollments
FOR EACH ROW
BEGIN
    IF EXISTS (
        SELECT 1 FROM Enrollments 
        WHERE student_id = NEW.student_id 
          AND course_id = NEW.course_id
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Học viên đã đăng ký khóa học này rồi.';
    END IF;
END;


-- T3: Trigger cập nhật số lượng học viên của khóa học

-- Bảng Courses (id, name, student_count)
CREATE TRIGGER update_course_count_after_insert
AFTER INSERT ON Enrollments
FOR EACH ROW
BEGIN
    UPDATE Courses
    SET student_count = student_count + 1
    WHERE id = NEW.course_id;
END;


-- T4: Trigger đánh dấu bài nộp trễ hạn

-- Bảng Assignments (id, due_date)
-- Bảng Submissions (id, assignment_id, submitted_at, is_late)
CREATE TRIGGER mark_late_submission
AFTER INSERT ON Submissions
FOR EACH ROW
BEGIN
    DECLARE due DATETIME;
    SELECT due_date INTO due FROM Assignments WHERE id = NEW.assignment_id;
    IF NEW.submitted_at > due THEN
        UPDATE Submissions
        SET is_late = 1
        WHERE id = NEW.id;
    END IF;
END;


-- T5: Trigger tự động cập nhật tiến độ khi có sự kiện liên quan
-- Bảng CourseProgress (student_id, course_id, progress)
CREATE TRIGGER update_progress_after_attendance
AFTER INSERT ON Attendance
FOR EACH ROW
BEGIN
    -- Giả sử mỗi điểm danh tăng tiến độ 5%
    UPDATE CourseProgress
    SET progress = progress + 5
    WHERE student_id = NEW.student_id 
      AND course_id = NEW.course_id;
END;




-----------------------------------------------------------------------------------------------------------------------------------------------




-- 4.1.3 Function

-- F1: Tính tỷ lệ điểm danh của học viên theo khóa
CREATE FUNCTION AttendanceRate(
    p_student_id INT,
    p_course_id INT
) RETURNS FLOAT
BEGIN
    DECLARE attended INT;
    DECLARE total INT;
    SELECT COUNT(*) INTO attended
    FROM Attendance
    WHERE student_id = p_student_id AND course_id = p_course_id AND attended = 1;
    SELECT COUNT(*) INTO total
    FROM Sessions
    WHERE course_id = p_course_id;
    RETURN (attended / total) * 100;
END;


-- F2: Tính tỷ lệ hoàn thành bài tập
CREATE FUNCTION AssignmentCompletionRate(
    p_student_id INT,
    p_course_id INT
) RETURNS FLOAT
BEGIN
    DECLARE completed INT;
    DECLARE total INT;
    SELECT COUNT(*) INTO completed
    FROM Submissions
    WHERE student_id = p_student_id AND course_id = p_course_id;
    SELECT COUNT(*) INTO total
    FROM Assignments
    WHERE course_id = p_course_id;
    RETURN (completed / total) * 100;
END;


-- F3: Tính tiến độ tổng hợp (progress_percent)
CREATE FUNCTION OverallProgress(
    p_student_id INT,
    p_course_id INT
) RETURNS FLOAT
BEGIN
    DECLARE attendance_rate FLOAT;
    DECLARE assignment_rate FLOAT;
    SET attendance_rate = AttendanceRate(p_student_id, p_course_id);
    SET assignment_rate = AssignmentCompletionRate(p_student_id, p_course_id);
    RETURN (attendance_rate + assignment_rate) / 2;
END;





-----------------------------------------------------------------------------------------------------------------------------------------------




-- 4.1.4 Cursor

-- C1: Cursor duyệt danh sách học viên trong khóa để cập nhật tiến độ hàng loạt
DELIMITER $$
CREATE PROCEDURE UpdateAllProgress()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE sid INT;
    DECLARE cid INT;
    DECLARE prog FLOAT;
    DECLARE cur CURSOR FOR 
        SELECT student_id, course_id FROM Enrollments;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN cur;
    read_loop: LOOP
        FETCH cur INTO sid, cid;
        IF done THEN
            LEAVE read_loop;
        END IF;
        -- Ví dụ tính tiến độ: tỷ lệ số buổi tham gia (attended) trên tổng buổi
        SELECT (COUNT(*)/ (SELECT COUNT(*) FROM Sessions WHERE course_id = cid) * 100)
        INTO prog
        FROM Attendance
        WHERE student_id = sid AND course_id = cid AND attended = 1;
        UPDATE CourseProgress
        SET progress = prog
        WHERE student_id = sid AND course_id = cid;
    END LOOP;
    CLOSE cur;
END$$
DELIMITER ;


-- C2: Cursor tạo báo cáo tổng hợp theo từng khóa
DELIMITER $$
CREATE PROCEDURE ReportByCourse()
BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE cid INT;
    DECLARE cur CURSOR FOR SELECT id FROM Courses;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN cur;
    report_loop: LOOP
        FETCH cur INTO cid;
        IF done THEN
            LEAVE report_loop;
        END IF;
        -- Hiển thị báo cáo số học viên của khóa
        SELECT cid AS course_id, COUNT(*) AS num_students
        FROM Enrollments
        WHERE course_id = cid;
    END LOOP;
    CLOSE cur;
END$$
DELIMITER ;



-----------------------------------------------------------------------------------------------------------------------------------------------




