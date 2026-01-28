/* 
  Advanced Database Features - LMS Project 
  Includes: Stored Procedures, Triggers, Functions, Cursors
*/

-- =============================================
-- 4.1.1 STORED PROCEDURES
-- =============================================

-- SP1: Đăng ký khóa học cho học viên
CREATE OR ALTER PROCEDURE sp_RegisterCourse
    @student_id BIGINT,
    @course_id BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Check if already exists (handled by Trigger T2 usually, but good to check here too or let error bubble)
    IF EXISTS (SELECT 1 FROM Enrollment WHERE student_id = @student_id AND course_id = @course_id)
    BEGIN
        THROW 50001, 'Sinh viên đã đăng ký khóa học này.', 1;
        RETURN;
    END

    INSERT INTO Enrollment (student_id, course_id, status, joined_at)
    VALUES (@student_id, @course_id, 'ACTIVE', SYSDATETIME());
    
    PRINT 'Đăng ký thành công!';
END;
GO

-- SP2: Cập nhật trạng thái đăng ký
CREATE OR ALTER PROCEDURE sp_UpdateEnrollmentStatus
    @enrollment_id BIGINT,
    @new_status VARCHAR(20)
AS
BEGIN
    UPDATE Enrollment
    SET status = @new_status
    WHERE enrollment_id = @enrollment_id;
END;
GO

-- SP3: Ghi nhận điểm danh buổi học
CREATE OR ALTER PROCEDURE sp_TakeAttendance
    @enrollment_id BIGINT,
    @session_date DATE,
    @status VARCHAR(20)
AS
BEGIN
    MERGE INTO Attendance AS Target
    USING (SELECT @enrollment_id AS enrollment_id, @session_date AS session_date) AS Source
    ON Target.enrollment_id = Source.enrollment_id AND Target.session_date = Source.session_date
    WHEN MATCHED THEN
        UPDATE SET status = @status
    WHEN NOT MATCHED THEN
        INSERT (enrollment_id, session_date, status)
        VALUES (@enrollment_id, @session_date, @status);
END;
GO

-- SP4: Nộp bài tập và lưu lịch sử nộp
CREATE OR ALTER PROCEDURE sp_SubmitAssignment
    @assignment_id BIGINT,
    @student_id BIGINT,
    @file_url VARCHAR(255)
AS
BEGIN
    -- Upsert submission
    IF EXISTS (SELECT 1 FROM Submission WHERE assignment_id = @assignment_id AND student_id = @student_id)
    BEGIN
        UPDATE Submission
        SET file_url = @file_url, submitted_at = SYSDATETIME()
        WHERE assignment_id = @assignment_id AND student_id = @student_id;
    END
    ELSE
    BEGIN
        INSERT INTO Submission (assignment_id, student_id, file_url, submitted_at)
        VALUES (@assignment_id, @student_id, @file_url, SYSDATETIME());
    END
END;
GO

-- SP5: Cập nhật tiến độ học tập (Example implementation: Calculates % of materials viewed or assignments done?)
-- Since we don't have "Material Viewed", we will use Assignments Completed %
-- Assuming we add a 'progress' column to Enrollment or return it.
-- Let's add a column if not exists
IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'progress' AND Object_ID = Object_ID(N'Enrollment'))
BEGIN
    ALTER TABLE Enrollment ADD progress DECIMAL(5,2) DEFAULT 0.0;
END;
GO

CREATE OR ALTER PROCEDURE sp_UpdateStudentProgress
    @course_id BIGINT,
    @student_id BIGINT
AS
BEGIN
    DECLARE @total_assign INT;
    DECLARE @done_assign INT;
    DECLARE @percent DECIMAL(5,2);

    SELECT @total_assign = COUNT(*) FROM Assignment WHERE course_id = @course_id;
    SELECT @done_assign = COUNT(*) FROM Submission s 
                          JOIN Assignment a ON s.assignment_id = a.assignment_id 
                          WHERE a.course_id = @course_id AND s.student_id = @student_id;

    IF @total_assign = 0 
        SET @percent = 100;
    ELSE
        SET @percent = (@done_assign * 100.0) / @total_assign;

    UPDATE Enrollment 
    SET progress = @percent
    WHERE course_id = @course_id AND student_id = @student_id;
END;
GO


-- =============================================
-- 4.1.2 TRIGGERS
-- =============================================

-- T1: Trigger Encrypt Password (Mock implementation via simple hashing)
CREATE OR ALTER TRIGGER tr_EncryptPassword
ON Users
INSTEAD OF INSERT
AS
BEGIN
    INSERT INTO Users (email, password_hash, first_name, last_name, role, status, created_at)
    SELECT 
        email, 
        CONVERT(VARCHAR(255), HASHBYTES('SHA2_256', password_hash), 2), -- Mock hashing
        first_name, last_name, role, status, created_at
    FROM inserted;
END;
GO

-- T2: Prevent Duplicate Enrollment (Already handled by UQ constraint, but adding custom error msg)
CREATE OR ALTER TRIGGER tr_CheckDuplicateEnrollment
ON Enrollment
AFTER INSERT
AS
BEGIN
    IF EXISTS (
        SELECT student_id, course_id, COUNT(*)
        FROM Enrollment
        WHERE status = 'ACTIVE'
        GROUP BY student_id, course_id
        HAVING COUNT(*) > 1
    )
    BEGIN
        RAISERROR('Học viên đã đăng ký khóa học này rồi!', 16, 1);
        ROLLBACK TRANSACTION;
    END
END;
GO

-- T3: Update Student Count in Course
-- First ensure column exists
IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'student_count' AND Object_ID = Object_ID(N'Course'))
BEGIN
    ALTER TABLE Course ADD student_count INT DEFAULT 0;
END;
GO

CREATE OR ALTER TRIGGER tr_UpdateStudentCount
ON Enrollment
AFTER INSERT, DELETE, UPDATE
AS
BEGIN
    -- Update for inserted
    UPDATE C
    SET C.student_count = (SELECT COUNT(*) FROM Enrollment E WHERE E.course_id = C.course_id AND E.status = 'ACTIVE')
    FROM Course C
    WHERE C.course_id IN (SELECT course_id FROM inserted) OR C.course_id IN (SELECT course_id FROM deleted);
END;
GO

-- T4: Mark Late Submission
-- We'll imply "Marking" means maybe appending " (LATE)" to the file_url or just handling logic.
-- Ideally we'd have a 'is_late' column. Let's add one to Submission.
IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'is_late' AND Object_ID = Object_ID(N'Submission'))
BEGIN
    ALTER TABLE Submission ADD is_late BIT DEFAULT 0;
END;
GO

CREATE OR ALTER TRIGGER tr_MarkLateSubmission
ON Submission
AFTER INSERT
AS
BEGIN
    UPDATE S
    SET is_late = 1
    FROM Submission S
    JOIN inserted I ON S.submission_id = I.submission_id
    JOIN Assignment A ON I.assignment_id = A.assignment_id
    WHERE I.submitted_at > A.deadline;
END;
GO

-- T5: Auto Update Progress
CREATE OR ALTER TRIGGER tr_AutoUpdateProgress
ON Submission
AFTER INSERT, UPDATE
AS
BEGIN
    DECLARE @course_id BIGINT;
    DECLARE @student_id BIGINT;

    -- Taking from inserted (simplified for single row op)
    SELECT TOP 1 @student_id = I.student_id, @course_id = A.course_id
    FROM inserted I
    JOIN Assignment A ON I.assignment_id = A.assignment_id;

    EXEC sp_UpdateStudentProgress @course_id, @student_id;
END;
GO


-- =============================================
-- 4.1.3 FUNCTIONS
-- =============================================

-- F1: Calculate Attendance Rate
CREATE OR ALTER FUNCTION fn_AttendanceRate(@enrollment_id BIGINT)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @total_sessions INT;
    DECLARE @present_sessions INT;
    
    SELECT @total_sessions = COUNT(*) FROM Attendance WHERE enrollment_id = @enrollment_id;
    SELECT @present_sessions = COUNT(*) FROM Attendance WHERE enrollment_id = @enrollment_id AND status = 'PRESENT';

    IF @total_sessions = 0 RETURN 100.0;
    
    RETURN (@present_sessions * 100.0) / @total_sessions;
END;
GO

-- F2: Assignment Completion Rate
CREATE OR ALTER FUNCTION fn_AssignmentCompletion(@student_id BIGINT, @course_id BIGINT)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @total INT;
    DECLARE @submitted INT;

    SELECT @total = COUNT(*) FROM Assignment WHERE course_id = @course_id;
    SELECT @submitted = COUNT(*) FROM Submission s JOIN Assignment a ON s.assignment_id = a.assignment_id 
                        WHERE a.course_id = @course_id AND s.student_id = @student_id;

    IF @total = 0 RETURN 100.0;
    RETURN (@submitted * 100.0) / @total;
END;
GO

-- F3: Total Progress (Weighted: 30% Attendance, 70% Assignments)
CREATE OR ALTER FUNCTION fn_TotalProgress(@enrollment_id BIGINT)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @att_rate DECIMAL(5,2);
    DECLARE @assign_rate DECIMAL(5,2);
    DECLARE @student_id BIGINT;
    DECLARE @course_id BIGINT;

    SELECT @student_id = student_id, @course_id = course_id FROM Enrollment WHERE enrollment_id = @enrollment_id;

    SET @att_rate = dbo.fn_AttendanceRate(@enrollment_id);
    SET @assign_rate = dbo.fn_AssignmentCompletion(@student_id, @course_id);

    RETURN (@att_rate * 0.3) + (@assign_rate * 0.7);
END;
GO


-- =============================================
-- 4.1.4 CURSORS
-- =============================================

-- C1: Batch Update Progress for ALL Students in a Course
CREATE OR ALTER PROCEDURE sp_BatchUpdateProgress_Cursor
    @course_id BIGINT
AS
BEGIN
    DECLARE @s_id BIGINT;
    
    DECLARE cur_progress CURSOR FOR 
        SELECT student_id FROM Enrollment WHERE course_id = @course_id;

    OPEN cur_progress;
    FETCH NEXT FROM cur_progress INTO @s_id;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC sp_UpdateStudentProgress @course_id, @s_id;
        FETCH NEXT FROM cur_progress INTO @s_id;
    END

    CLOSE cur_progress;
    DEALLOCATE cur_progress;
END;
GO

-- C2: Course Report
-- Returns a result set using a cursor to build a temp table (demonstration purposes)
CREATE OR ALTER PROCEDURE sp_CourseReport_Cursor
AS
BEGIN
    CREATE TABLE #Report (CourseName NVARCHAR(255), StudentCount INT, AvgProgress DECIMAL(5,2));

    DECLARE @c_id BIGINT;
    DECLARE @c_name NVARCHAR(255);
    DECLARE @s_count INT;
    DECLARE @avg_prog DECIMAL(5,2);

    DECLARE cur_report CURSOR FOR SELECT course_id, name FROM Course;
    
    OPEN cur_report;
    FETCH NEXT FROM cur_report INTO @c_id, @c_name;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @s_count = COUNT(*) FROM Enrollment WHERE course_id = @c_id AND status = 'ACTIVE';
        SELECT @avg_prog = AVG(progress) FROM Enrollment WHERE course_id = @c_id;

        INSERT INTO #Report VALUES (@c_name, @s_count, ISNULL(@avg_prog, 0));

        FETCH NEXT FROM cur_report INTO @c_id, @c_name;
    END

    CLOSE cur_report;
    DEALLOCATE cur_report;

    SELECT * FROM #Report;
    DROP TABLE #Report;
END;
GO
