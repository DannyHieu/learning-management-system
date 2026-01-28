/* =====================================================
   FUNCTIONS - LMS_DB (SQL Server)
   Phần 4.1.3: Function tính toán thống kê
   F1: Tỷ lệ điểm danh
   F2: Tỷ lệ hoàn thành bài tập
   F3: Tiến độ tổng hợp (progress_percent)
   ===================================================== */

USE LMS_DB;
GO

--------------------------------------------------------
-- F1: Tính tỷ lệ điểm danh của học viên theo khóa
-- - Input: @enrollment_id
-- - Output: % số buổi PRESENT trên tổng buổi trong Attendance
--------------------------------------------------------
CREATE OR ALTER FUNCTION fn_AttendanceRate
(
    @enrollment_id BIGINT
)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @total_sessions   INT;
    DECLARE @present_sessions INT;

    SELECT @total_sessions = COUNT(*)
    FROM Attendance
    WHERE enrollment_id = @enrollment_id;

    SELECT @present_sessions = COUNT(*)
    FROM Attendance
    WHERE enrollment_id = @enrollment_id
      AND status        = 'PRESENT';

    IF @total_sessions = 0
        RETURN 100.0;

    RETURN (@present_sessions * 100.0) / @total_sessions;
END;
GO

--------------------------------------------------------
-- F2: Tính tỷ lệ hoàn thành bài tập của học viên trong khóa
-- - Input: @student_id, @course_id
-- - Output: % số bài đã nộp / tổng số bài trong khóa
--------------------------------------------------------
CREATE OR ALTER FUNCTION fn_AssignmentCompletion
(
    @student_id BIGINT,
    @course_id  BIGINT
)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @total     INT;
    DECLARE @submitted INT;

    SELECT @total = COUNT(*)
    FROM Assignment
    WHERE course_id = @course_id;

    SELECT @submitted = COUNT(*)
    FROM Submission s
    JOIN Assignment a ON s.assignment_id = a.assignment_id
    WHERE a.course_id  = @course_id
      AND s.student_id = @student_id;

    IF @total = 0
        RETURN 100.0;

    RETURN (@submitted * 100.0) / @total;
END;
GO

--------------------------------------------------------
-- F3: Tính tiến độ tổng hợp (progress_percent)
-- - Input: @enrollment_id
-- - Công thức:
--   TotalProgress = 0.3 * AttendanceRate + 0.7 * AssignmentCompletion
--------------------------------------------------------
CREATE OR ALTER FUNCTION fn_TotalProgress
(
    @enrollment_id BIGINT
)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @att_rate   DECIMAL(5,2);
    DECLARE @assign_rate DECIMAL(5,2);
    DECLARE @student_id BIGINT;
    DECLARE @course_id  BIGINT;

    SELECT
        @student_id = student_id,
        @course_id  = course_id
    FROM Enrollment
    WHERE enrollment_id = @enrollment_id;

    SET @att_rate   = dbo.fn_AttendanceRate(@enrollment_id);
    SET @assign_rate = dbo.fn_AssignmentCompletion(@student_id, @course_id);

    RETURN (@att_rate * 0.3) + (@assign_rate * 0.7);
END;
GO

/* ============= TEST MẪU (chạy sau khi tạo FUNCTION) ======

-- F1: attendance rate cho 1 enrollment
SELECT dbo.fn_AttendanceRate(1) AS AttendanceRate_Enroll1;

-- F2: assignment completion cho student 1 trong course 1
SELECT dbo.fn_AssignmentCompletion(1, 1) AS AssignmentCompletion_Student1_Course1;

-- F3: tổng tiến độ cho enrollment 1
SELECT dbo.fn_TotalProgress(1) AS TotalProgress_Enroll1;

========================================================== */