/* =====================================================
   STORED PROCEDURES - LMS_DB (SQL Server)
   Phần 4.1.1: Xử lý nghiệp vụ khóa học
   SP1: Đăng ký khóa học
   SP2: Cập nhật trạng thái đăng ký
   SP3: Ghi nhận điểm danh
   SP4: Nộp bài tập
   SP5: Cập nhật tiến độ học tập
   ===================================================== */

USE LMS_DB;
GO

--------------------------------------------------------
-- SP1: Đăng ký khóa học cho học viên
-- - Input: @student_id, @course_id
-- - Logic:
--   + Kiểm tra đã tồn tại Enrollment ACTIVE cho cặp (student, course) hay chưa.
--   + Nếu có -> THROW lỗi.
--   + Nếu chưa -> INSERT bản ghi mới vào Enrollment.
--------------------------------------------------------
CREATE OR ALTER PROCEDURE sp_RegisterCourse
    @student_id BIGINT,
    @course_id BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (
        SELECT 1
        FROM Enrollment
        WHERE student_id = @student_id
          AND course_id = @course_id
          AND status = 'ACTIVE'
    )
    BEGIN
        THROW 50001, 'Sinh viên đã đăng ký khóa học này.', 1;
        RETURN;
    END;

    INSERT INTO Enrollment (student_id, course_id, status, joined_at)
    VALUES (@student_id, @course_id, 'ACTIVE', SYSDATETIME());

    PRINT 'Đăng ký thành công!';
END;
GO

--------------------------------------------------------
-- SP2: Cập nhật trạng thái đăng ký
-- - Dùng khi muốn set Enrollment.status = 'ACTIVE' / 'REMOVED'
--------------------------------------------------------
CREATE OR ALTER PROCEDURE sp_UpdateEnrollmentStatus
    @enrollment_id BIGINT,
    @new_status    VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Enrollment
    SET status = @new_status
    WHERE enrollment_id = @enrollment_id;
END;
GO

--------------------------------------------------------
-- SP3: Ghi nhận điểm danh buổi học
-- - Nếu tồn tại bản ghi Attendance (enrollment_id, session_date)
--   thì UPDATE status.
-- - Nếu chưa, INSERT mới.
--------------------------------------------------------
CREATE OR ALTER PROCEDURE sp_TakeAttendance
    @enrollment_id BIGINT,
    @session_date  DATE,
    @status        VARCHAR(20) -- 'PRESENT' / 'ABSENT'
AS
BEGIN
    SET NOCOUNT ON;

    MERGE INTO Attendance AS Target
    USING (
        SELECT @enrollment_id AS enrollment_id,
               @session_date  AS session_date
    ) AS Source
    ON Target.enrollment_id = Source.enrollment_id
       AND Target.session_date = Source.session_date
    WHEN MATCHED THEN
        UPDATE SET status = @status
    WHEN NOT MATCHED THEN
        INSERT (enrollment_id, session_date, status)
        VALUES (@enrollment_id, @session_date, @status);
END;
GO

--------------------------------------------------------
-- SP4: Nộp bài tập và lưu lịch sử nộp
-- - Nếu đã tồn tại Submission cho (assignment_id, student_id)
--   -> UPDATE file_url + submitted_at
-- - Nếu chưa -> INSERT mới
--------------------------------------------------------
CREATE OR ALTER PROCEDURE sp_SubmitAssignment
    @assignment_id BIGINT,
    @student_id    BIGINT,
    @file_url      VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM Submission
        WHERE assignment_id = @assignment_id
          AND student_id   = @student_id
    )
    BEGIN
        UPDATE Submission
        SET file_url    = @file_url,
            submitted_at = SYSDATETIME()
        WHERE assignment_id = @assignment_id
          AND student_id    = @student_id;
    END
    ELSE
    BEGIN
        INSERT INTO Submission (assignment_id, student_id, file_url, submitted_at)
        VALUES (@assignment_id, @student_id, @file_url, SYSDATETIME());
    END;
END;
GO

--------------------------------------------------------
-- SP5: Cập nhật tiến độ học tập của học viên trong khóa
-- - Tiến độ = (số bài đã nộp / tổng số bài trong khóa) * 100
-- - Lưu vào cột Enrollment.progress (DECIMAL(5,2))
--------------------------------------------------------

-- Đảm bảo cột progress tồn tại trong Enrollment
IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE Name = N'progress'
      AND Object_ID = Object_ID(N'Enrollment')
)
BEGIN
    ALTER TABLE Enrollment
    ADD progress DECIMAL(5,2) DEFAULT 0.0;
END;
GO

CREATE OR ALTER PROCEDURE sp_UpdateStudentProgress
    @course_id  BIGINT,
    @student_id BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @total_assign INT;
    DECLARE @done_assign  INT;
    DECLARE @percent      DECIMAL(5,2);

    SELECT @total_assign = COUNT(*)
    FROM Assignment
    WHERE course_id = @course_id;

    SELECT @done_assign = COUNT(*)
    FROM Submission  s
    JOIN Assignment  a ON s.assignment_id = a.assignment_id
    WHERE a.course_id = @course_id
      AND s.student_id = @student_id;

    IF @total_assign = 0
        SET @percent = 100;
    ELSE
        SET @percent = (@done_assign * 100.0) / @total_assign;

    UPDATE Enrollment
    SET progress = @percent
    WHERE course_id = @course_id
      AND student_id = @student_id;
END;
GO

/* ============= TEST MẪU (chạy sau khi tạo SP) ============

-- SP1: đăng ký khóa học
EXEC sp_RegisterCourse @student_id = 1, @course_id = 2;
SELECT * FROM Enrollment WHERE student_id = 1 AND course_id = 2;

-- SP2: cập nhật trạng thái
EXEC sp_UpdateEnrollmentStatus @enrollment_id = 1, @new_status = 'REMOVED';
SELECT * FROM Enrollment WHERE enrollment_id = 1;

-- SP3: điểm danh
EXEC sp_TakeAttendance @enrollment_id = 1, @session_date = '2026-01-19', @status = 'PRESENT';
SELECT * FROM Attendance WHERE enrollment_id = 1;

-- SP4: nộp bài
EXEC sp_SubmitAssignment @assignment_id = 1, @student_id = 1, @file_url = '/submit/test.pdf';
SELECT * FROM Submission WHERE assignment_id = 1 AND student_id = 1;

-- SP5: cập nhật progress
EXEC sp_UpdateStudentProgress @course_id = 1, @student_id = 1;
SELECT * FROM Enrollment WHERE course_id = 1 AND student_id = 1;

========================================================== */