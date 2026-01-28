/* =====================================================
   TRIGGERS - LMS_DB (SQL Server)
   Phần 4.1.2: Trigger bảo vệ dữ liệu & thống kê
   T1: Mã hóa mật khẩu
   T2: Chống đăng ký trùng khóa học
   T3: Cập nhật số lượng học viên của khóa
   T4: Đánh dấu bài nộp trễ hạn
   T5: Tự động cập nhật tiến độ khi có nộp bài
   ===================================================== */

USE LMS_DB;
GO

--------------------------------------------------------
-- T1: Trigger mã hóa mật khẩu trước khi insert User
-- - Sử dụng HASHBYTES('SHA2_256', password_hash) làm mock-hash.
-- - Kiểu INSTEAD OF INSERT để chặn insert nguyên bản.
--------------------------------------------------------
CREATE OR ALTER TRIGGER tr_EncryptPassword
ON Users
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Users (email, password_hash, first_name, last_name, role, status, created_at)
    SELECT 
        email,
        CONVERT(VARCHAR(255), HASHBYTES('SHA2_256', password_hash), 2),
        first_name,
        last_name,
        role,
        status,
        created_at
    FROM inserted;
END;
GO

--------------------------------------------------------
-- T2: Trigger kiểm tra không cho đăng ký trùng khóa học
-- - Sau khi INSERT vào Enrollment:
--   + Nếu tồn tại hơn 1 bản ghi ACTIVE cho (student_id, course_id)
--     -> RAISERROR và ROLLBACK.
-- - Lưu ý: UQ_Enrollment (course_id, student_id) cũng đã bảo vệ,
--   trigger này thêm thông báo lỗi rõ ràng.
--------------------------------------------------------
CREATE OR ALTER TRIGGER tr_CheckDuplicateEnrollment
ON Enrollment
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT student_id, course_id, COUNT(*) AS cnt
        FROM Enrollment
        WHERE status = 'ACTIVE'
        GROUP BY student_id, course_id
        HAVING COUNT(*) > 1
    )
    BEGIN
        RAISERROR('Học viên đã đăng ký khóa học này rồi!', 16, 1);
        ROLLBACK TRANSACTION;
    END;
END;
GO

--------------------------------------------------------
-- T3: Trigger cập nhật số lượng học viên của khóa học
-- - Cột Course.student_count được thêm nếu chưa tồn tại.
-- - Sau INSERT / DELETE / UPDATE trên Enrollment:
--   + Cập nhật Course.student_count = COUNT(Enrollment ACTIVE)
--------------------------------------------------------

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE Name = N'student_count'
      AND Object_ID = Object_ID(N'Course')
)
BEGIN
    ALTER TABLE Course
    ADD student_count INT DEFAULT 0;
END;
GO

CREATE OR ALTER TRIGGER tr_UpdateStudentCount
ON Enrollment
AFTER INSERT, DELETE, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE C
    SET C.student_count = (
        SELECT COUNT(*)
        FROM Enrollment E
        WHERE E.course_id = C.course_id
          AND E.status   = 'ACTIVE'
    )
    FROM Course C
    WHERE C.course_id IN (
        SELECT course_id FROM inserted
        UNION
        SELECT course_id FROM deleted
    );
END;
GO

--------------------------------------------------------
-- T4: Trigger đánh dấu bài nộp trễ hạn
-- - Thêm cột is_late (BIT) vào Submission nếu chưa tồn tại.
-- - Sau khi INSERT Submission:
--   + Nếu submitted_at > Assignment.deadline -> is_late = 1
--------------------------------------------------------

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE Name = N'is_late'
      AND Object_ID = Object_ID(N'Submission')
)
BEGIN
    ALTER TABLE Submission
    ADD is_late BIT DEFAULT 0;
END;
GO

CREATE OR ALTER TRIGGER tr_MarkLateSubmission
ON Submission
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE S
    SET is_late = 1
    FROM Submission S
    JOIN inserted I ON S.submission_id = I.submission_id
    JOIN Assignment A ON I.assignment_id = A.assignment_id
    WHERE I.submitted_at > A.deadline;
END;
GO

--------------------------------------------------------
-- T5: Trigger tự động cập nhật tiến độ khi có Submission
-- - Sau INSERT / UPDATE trên Submission:
--   + Lấy course_id từ Assignment
--   + Gọi sp_UpdateStudentProgress(course_id, student_id)
--------------------------------------------------------
CREATE OR ALTER TRIGGER tr_AutoUpdateProgress
ON Submission
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @course_id  BIGINT;
    DECLARE @student_id BIGINT;

    SELECT TOP 1
        @student_id = I.student_id,
        @course_id  = A.course_id
    FROM inserted I
    JOIN Assignment A ON I.assignment_id = A.assignment_id;

    IF @course_id IS NOT NULL AND @student_id IS NOT NULL
    BEGIN
        EXEC sp_UpdateStudentProgress @course_id = @course_id,
                                      @student_id = @student_id;
    END;
END;
GO

/* ============= TEST MẪU (chạy sau khi tạo TRIGGER) =======

-- T1: insert user mới, kiểm tra password_hash đã hash
INSERT INTO Users (email, password_hash, first_name, last_name, role, status)
VALUES ('test@lms.com', 'PlainPassword', N'Test', N'User', 'STUDENT', 'ACTIVE');
SELECT * FROM Users WHERE email = 'test@lms.com';

-- T2: thử insert 2 Enrollment ACTIVE trùng (course_id, student_id)
INSERT INTO Enrollment (course_id, student_id, status)
VALUES (1, 1, 'ACTIVE');  -- nếu đã tồn tại, trigger sẽ RAISERROR

-- T3: kiểm tra student_count
SELECT * FROM Course;
INSERT INTO Enrollment (course_id, student_id, status)
VALUES (1, 5, 'ACTIVE');
SELECT * FROM Course WHERE course_id = 1;

-- T4: insert Submission trễ hạn
-- (chỉnh submitted_at > deadline để test)
INSERT INTO Submission (assignment_id, student_id, file_url, submitted_at)
VALUES (1, 1, '/submit/late.pdf', DATEADD(DAY, 10, GETDATE()));
SELECT * FROM Submission WHERE file_url = '/submit/late.pdf';

-- T5: khi INSERT/UPDATE Submission, kiểm tra Enrollment.progress được cập nhật
UPDATE Submission
SET score = 9.0
WHERE submission_id = 1;
SELECT * FROM Enrollment;

========================================================== */