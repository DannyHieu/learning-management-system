/* =====================================================
   CURSORS - LMS_DB (SQL Server)
   Phần 4.1.4: Cursor xử lý hàng loạt / báo cáo
   C1: Cập nhật tiến độ hàng loạt cho 1 khóa
   C2: Báo cáo tổng hợp theo từng khóa
   ===================================================== */

USE LMS_DB;
GO

--------------------------------------------------------
-- C1: Cursor duyệt danh sách học viên trong khóa
--     để cập nhật tiến độ hàng loạt
-- - Input: @course_id
-- - Logic:
--   + Cursor duyệt Enrollment.student_id cho course_id
--   + Gọi sp_UpdateStudentProgress cho từng student
--------------------------------------------------------
CREATE OR ALTER PROCEDURE sp_BatchUpdateProgress_Cursor
    @course_id BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @s_id BIGINT;

    DECLARE cur_progress CURSOR FOR
        SELECT student_id
        FROM Enrollment
        WHERE course_id = @course_id;

    OPEN cur_progress;
    FETCH NEXT FROM cur_progress INTO @s_id;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC sp_UpdateStudentProgress
            @course_id  = @course_id,
            @student_id = @s_id;

        FETCH NEXT FROM cur_progress INTO @s_id;
    END;

    CLOSE cur_progress;
    DEALLOCATE cur_progress;
END;
GO

--------------------------------------------------------
-- C2: Cursor tạo báo cáo tổng hợp theo từng khóa
-- - Tạo bảng tạm #Report:
--   + CourseName
--   + StudentCount
--   + AvgProgress
-- - Cursor duyệt từng Course, tính thống kê, insert vào #Report
--------------------------------------------------------
CREATE OR ALTER PROCEDURE sp_CourseReport_Cursor
AS
BEGIN
    SET NOCOUNT ON;

    CREATE TABLE #Report (
        CourseName   NVARCHAR(255),
        StudentCount INT,
        AvgProgress  DECIMAL(5,2)
    );

    DECLARE @c_id     BIGINT;
    DECLARE @c_name   NVARCHAR(255);
    DECLARE @s_count  INT;
    DECLARE @avg_prog DECIMAL(5,2);

    DECLARE cur_report CURSOR FOR
        SELECT course_id, name
        FROM Course;

    OPEN cur_report;
    FETCH NEXT FROM cur_report INTO @c_id, @c_name;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @s_count = COUNT(*)
        FROM Enrollment
        WHERE course_id = @c_id
          AND status    = 'ACTIVE';

        SELECT @avg_prog = AVG(progress)
        FROM Enrollment
        WHERE course_id = @c_id;

        INSERT INTO #Report (CourseName, StudentCount, AvgProgress)
        VALUES (@c_name, @s_count, ISNULL(@avg_prog, 0));

        FETCH NEXT FROM cur_report INTO @c_id, @c_name;
    END;

    CLOSE cur_report;
    DEALLOCATE cur_report;

    SELECT * FROM #Report;
    DROP TABLE #Report;
END;
GO

/* ============= TEST MẪU (chạy sau khi tạo CURSOR) ========

-- C1: cập nhật progress hàng loạt cho khóa 1
EXEC sp_BatchUpdateProgress_Cursor @course_id = 1;
SELECT * FROM Enrollment WHERE course_id = 1;

-- C2: tạo báo cáo tổng hợp cho tất cả khóa
EXEC sp_CourseReport_Cursor;

========================================================== */