import React, { useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./../App.css";

// Define types for tabs and options
type TabType =
  | "storedProcedures"
  | "triggers"
  | "functions"
  | "cursors"
  | "importExport";

interface SqlOption {
  id: string;
  name: string;
  sql: string;
}

interface TabConfig {
  id: TabType;
  label: string;
  options: SqlOption[];
}

// SQL definitions from the SQL file
// SQL definitions for MSSQL (LMS_DB)
const storedProcedures: SqlOption[] = [
  {
    id: "sp1",
    name: "SP1: Đăng ký khóa học cho học viên",
    sql: `/* SP1: Đăng ký khóa học cho học viên
   - Input: @student_id, @course_id
   - Chức năng: tạo bản ghi Enrollment mới nếu chưa tồn tại, tránh trùng đăng ký
   - Bảng liên quan: Enrollment
   - Ràng buộc: chỉ cho phép một đăng ký ACTIVE cho mỗi (student, course)
*/
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
-- TEST CASE:
-- 1) Đăng ký mới (thành công):
--    EXEC sp_RegisterCourse @student_id = 1, @course_id = 2;
--    SELECT * FROM Enrollment WHERE student_id = 1 AND course_id = 2;
-- 2) Đăng ký trùng (bị THROW lỗi):
--    EXEC sp_RegisterCourse @student_id = 1, @course_id = 2;`,
  },
  {
    id: "sp2",
    name: "SP2: Cập nhật trạng thái đăng ký",
    sql: `/* SP2: Cập nhật trạng thái đăng ký
   - Input: @enrollment_id, @new_status ('ACTIVE' / 'REMOVED')
   - Chức năng: đổi trạng thái Enrollment
   - Bảng liên quan: Enrollment
*/
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
-- TEST CASE:
-- 1) Chuyển 1 đăng ký sang REMOVED:
--    EXEC sp_UpdateEnrollmentStatus @enrollment_id = 1, @new_status = 'REMOVED';
--    SELECT * FROM Enrollment WHERE enrollment_id = 1;`,
  },
  {
    id: "sp3",
    name: "SP3: Ghi nhận điểm danh buổi học",
    sql: `/* SP3: Ghi nhận điểm danh buổi học
   - Input: @enrollment_id, @session_date, @status ('PRESENT' / 'ABSENT')
   - Chức năng: upsert Attendance (nếu đã có thì update, nếu chưa thì insert)
   - Bảng liên quan: Attendance
*/
CREATE OR ALTER PROCEDURE sp_TakeAttendance
    @enrollment_id BIGINT,
    @session_date  DATE,
    @status        VARCHAR(20)
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
-- TEST CASE:
-- 1) Điểm danh mới:
--    EXEC sp_TakeAttendance @enrollment_id = 1, @session_date = '2026-01-20', @status = 'PRESENT';
--    SELECT * FROM Attendance WHERE enrollment_id = 1;
-- 2) Sửa trạng thái buổi đã điểm danh:
--    EXEC sp_TakeAttendance @enrollment_id = 1, @session_date = '2026-01-20', @status = 'ABSENT';`,
  },
  {
    id: "sp4",
    name: "SP4: Nộp bài tập và lưu lịch sử nộp",
    sql: `/* SP4: Nộp bài tập và lưu lịch sử nộp
   - Input: @assignment_id, @student_id, @file_url
   - Chức năng: upsert Submission cho (assignment, student)
   - Bảng liên quan: Submission, Assignment
*/
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
-- TEST CASE:
-- 1) Nộp mới:
--    EXEC sp_SubmitAssignment @assignment_id = 1, @student_id = 1, @file_url = '/submit/test1.pdf';
--    SELECT * FROM Submission WHERE assignment_id = 1 AND student_id = 1;
-- 2) Nộp lại (cập nhật file_url + submitted_at):
--    EXEC sp_SubmitAssignment @assignment_id = 1, @student_id = 1, @file_url = '/submit/test1_v2.pdf';`,
  },
  {
    id: "sp5",
    name: "SP5: Cập nhật tiến độ học tập của học viên trong khóa",
    sql: `/* SP5: Cập nhật tiến độ học tập của học viên trong khóa
   - Input: @course_id, @student_id
   - Chức năng: tính % số Assignment đã nộp trên tổng Assignment của course
   - Bảng liên quan: Assignment, Submission, Enrollment
   - Kết quả: lưu vào Enrollment.progress (DECIMAL(5,2))
*/
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
-- TEST CASE:
-- 1) Cập nhật tiến độ cho student 1, course 1:
--    EXEC sp_UpdateStudentProgress @course_id = 1, @student_id = 1;
--    SELECT * FROM Enrollment WHERE course_id = 1 AND student_id = 1;`,
  },
];

const triggers: SqlOption[] = [
  {
    id: "t1",
    name: "T1: Mã hóa mật khẩu trước khi insert/update User",
    sql: `/* T1: Mã hóa mật khẩu trước khi insert User
   - Bảng: Users
   - Kiểu: INSTEAD OF INSERT
   - Chức năng: hash password_hash bằng SHA2_256 trước khi lưu
*/
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
-- TEST CASE:
-- 1) Insert user mới:
--    INSERT INTO Users (email, password_hash, first_name, last_name, role, status)
--    VALUES ('test_hash@lms.com', 'PlainPassword', N'Test', N'User', 'STUDENT', 'ACTIVE');
--    SELECT email, password_hash FROM Users WHERE email = 'test_hash@lms.com';`,
  },
  {
    id: "t2",
    name: "T2: Kiểm tra không cho đăng ký trùng khóa học",
    sql: `/* T2: Chặn đăng ký trùng khóa học
   - Bảng: Enrollment
   - Kiểu: AFTER INSERT
   - Chức năng: nếu có >1 bản ghi ACTIVE cho (student_id, course_id) thì RAISERROR + ROLLBACK
*/
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
-- TEST CASE:
-- 1) Thử insert trùng:
--    INSERT INTO Enrollment (course_id, student_id, status) VALUES (1, 1, 'ACTIVE');
--    -> Expect: RAISERROR + ROLLBACK (không thêm bản ghi mới);`,
  },
  {
    id: "t3",
    name: "T3: Cập nhật số lượng học viên của khóa học",
    sql: `/* T3: Cập nhật Course.student_count khi Enrollment thay đổi
   - Bảng: Enrollment (trigger), Course (cập nhật)
   - Kiểu: AFTER INSERT, DELETE, UPDATE
   - Chức năng: student_count = số Enrollment ACTIVE
*/
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
-- TEST CASE:
-- 1) Thêm Enrollment:
--    INSERT INTO Enrollment (course_id, student_id, status) VALUES (1, 5, 'ACTIVE');
--    SELECT * FROM Course WHERE course_id = 1;
-- 2) Đổi status / xóa Enrollment và xem student_count thay đổi;`,
  },
  {
    id: "t4",
    name: "T4: Đánh dấu bài nộp trễ hạn",
    sql: `/* T4: Đánh dấu Submission trễ hạn
   - Bảng: Submission (trigger), Assignment (deadline)
   - Kiểu: AFTER INSERT
   - Chức năng: nếu submitted_at > deadline thì is_late = 1
*/
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
-- TEST CASE:
-- 1) Nộp bài sau deadline:
--    INSERT INTO Submission (assignment_id, student_id, file_url, submitted_at)
--    VALUES (1, 1, '/submit/late.pdf', DATEADD(DAY, 10, GETDATE()));
--    SELECT * FROM Submission WHERE file_url = '/submit/late.pdf';`,
  },
  {
    id: "t5",
    name: "T5: Tự động cập nhật tiến độ khi có sự kiện liên quan",
    sql: `/* T5: Tự động cập nhật tiến độ khi có Submission mới
   - Bảng: Submission (trigger), Assignment, Enrollment
   - Kiểu: AFTER INSERT, UPDATE
   - Chức năng: lấy course_id, student_id rồi gọi sp_UpdateStudentProgress
*/
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
-- TEST CASE:
-- 1) Update điểm/nộp bài:
--    UPDATE Submission SET score = 9.0 WHERE submission_id = 1;
--    SELECT * FROM Enrollment WHERE course_id = (SELECT course_id FROM Assignment WHERE assignment_id = 1);`,
  },
];

const functions: SqlOption[] = [
  {
    id: "f1",
    name: "F1: Tính tỷ lệ điểm danh của học viên theo khóa",
    sql: `/* F1: Tính tỷ lệ điểm danh
   - Input: @enrollment_id
   - Công thức: (số buổi PRESENT / tổng số buổi) * 100
   - Bảng: Attendance
*/
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
-- TEST CASE:
-- 1) SELECT dbo.fn_AttendanceRate(1) AS AttendanceRate_Enroll1;`,
  },
  {
    id: "f2",
    name: "F2: Tính tỷ lệ hoàn thành bài tập",
    sql: `/* F2: Tính tỷ lệ hoàn thành bài tập
   - Input: @student_id, @course_id
   - Công thức: (số bài đã nộp / tổng assignment của course) * 100
   - Bảng: Assignment, Submission
*/
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
-- TEST CASE:
-- 1) SELECT dbo.fn_AssignmentCompletion(1, 1) AS AssignmentCompletion_Student1_Course1;`,
  },
  {
    id: "f3",
    name: "F3: Tính tiến độ tổng hợp (progress_percent)",
    sql: `/* F3: Tính tiến độ tổng hợp (progress_percent)
   - Input: @enrollment_id
   - Công thức: 0.3 * AttendanceRate + 0.7 * AssignmentCompletion
   - Bảng: Enrollment, Attendance, Assignment, Submission
*/
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
-- TEST CASE:
-- 1) SELECT dbo.fn_TotalProgress(1) AS TotalProgress_Enroll1;`,
  },
];

const cursors: SqlOption[] = [
  {
    id: "c1",
    name: "C1: Cursor duyệt danh sách học viên trong khóa để cập nhật tiến độ hàng loạt",
    sql: `DELIMITER $$
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
DELIMITER ;`,
  },
  {
    id: "c2",
    name: "C2: Cursor tạo báo cáo tổng hợp theo từng khóa",
    sql: `DELIMITER $$
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
        SELECT cid AS course_id, COUNT(*) AS num_students
        FROM Enrollments
        WHERE course_id = cid;
    END LOOP;
    CLOSE cur;
END$$
DELIMITER ;`,
  },
];

const SqlPlayground: React.FC = () => {
  const tabs: TabConfig[] = [
    {
      id: "storedProcedures",
      label: "Stored Procedures",
      options: storedProcedures,
    },
    { id: "triggers", label: "Triggers", options: triggers },
    { id: "functions", label: "Functions", options: functions },
    { id: "cursors", label: "Cursors", options: cursors },
    { id: "importExport", label: "Import/Export", options: [] },
  ];

  const [activeTab, setActiveTab] = useState<TabType>("storedProcedures");
  const [selectedOption, setSelectedOption] = useState<string>("sp1");
  const [sqlCode, setSqlCode] = useState<string>(storedProcedures[0].sql);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Import/Export states
  const [importExportMode, setImportExportMode] = useState<"import" | "export">(
    "import",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reportType, setReportType] = useState<string>("students");

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);
    setError(null);
    setResults([]);

    if (tabId === "importExport") {
      setImportExportMode("import");
      setSqlCode("");
    } else {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab && tab.options.length > 0) {
        const firstOption = tab.options[0];
        setSelectedOption(firstOption.id);
        setSqlCode(firstOption.sql);
      }
    }
  };

  const handleOptionChange = (optionId: string) => {
    setSelectedOption(optionId);
    const tab = tabs.find((t) => t.id === activeTab);
    const option = tab?.options.find((opt) => opt.id === optionId);
    if (option) {
      setSqlCode(option.sql);
    }
  };

  const handleRunSql = async () => {
    if (!sqlCode.trim()) {
      toast.error("SQL code is empty!");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:8080/api/sql/execute", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: sqlCode,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.statusText}`);
      }

      if (Array.isArray(data)) {
        setResults(data);
        toast.success("SQL executed successfully!");
      } else {
        setResults([]);
        toast.info("SQL executed, no results returned.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
      toast.error(err.message || "An error occurred.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith(".csv")) {
        setSelectedFile(file);
      } else {
        toast.error("Only .csv files are allowed!");
        e.target.value = "";
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to upload!");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("type", reportType === "user" ? "user" : "lesson");

    setLoading(true);
    try {
      const response = await fetch("http://localhost:8080/api/sql/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      toast.success(data.message || "Upload successful!");
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById(
        "file-input",
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (err: any) {
      toast.error(err.message || "Upload failed!");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8080/api/sql/export?type=${reportType}`,
        {
          method: "GET",
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Export failed");
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}_report.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Export successful!");
    } catch (err: any) {
      toast.error(err.message || "Export failed!");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const currentTab = tabs.find((t) => t.id === activeTab);

  return (
    <div className="sql-container">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="header-section">
        <h1>Nhóm 13 (IE103) Quản Lý Thông Tin</h1>
      </div>

      {/* Main Tabs */}
      <div className="tab-navigator">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content for SQL tabs (Stored Procedures, Triggers, Functions, Cursors) */}
      {activeTab !== "importExport" && currentTab && (
        <>
          {/* Option Selector */}
          <div
            className="option-selector"
            style={{
              margin: "20px 0",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <label htmlFor="sql-option" style={{ fontWeight: "bold" }}>
              Select Option:
            </label>
            <select
              id="sql-option"
              value={selectedOption}
              onChange={(e) => handleOptionChange(e.target.value)}
              style={{
                padding: "10px 15px",
                fontSize: "15px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                flex: "1",
                maxWidth: "700px",
                backgroundColor: "#fff",
                color: "#333",
                appearance: "none",
                WebkitAppearance: "none",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              }}
            >
              {currentTab.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <button
              className="run-btn"
              onClick={handleRunSql}
              disabled={loading}
              style={{
                marginBottom: 0,
                padding: "10px 25px",
                fontSize: "16px",
                borderRadius: "8px",
                boxShadow: "0 4px 6px rgba(4, 170, 109, 0.2)",
              }}
            >
              {loading ? "Running..." : "Run SQL »"}
            </button>
          </div>

          {/* SQL Editor */}
          <div className="editor-container">
            <textarea
              className="sql-editor"
              value={sqlCode}
              onChange={(e) => setSqlCode(e.target.value)}
              spellCheck={false}
            />
          </div>

          <h2>Result:</h2>

          <div className="result-section">
            <div className="record-count">
              Number of Records: {results.length}
            </div>

            {error ? (
              <div className="error-message">{error}</div>
            ) : (
              <div className="table-responsive">
                <table className="w3-table">
                  <thead>
                    <tr>
                      {results.length > 0 &&
                        Object.keys(results[0]).map((key) => (
                          <th key={key}>{key}</th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, index) => (
                      <tr key={index}>
                        {Object.values(row).map((val: any, i) => (
                          <td key={i}>{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Import/Export Tab */}
      {activeTab === "importExport" && (
        <div className="import-export-container" style={{ padding: "20px 0" }}>
          {/* Import/Export Mode Selector */}
          <div className="mode-selector" style={{ marginBottom: "20px" }}>
            <button
              className={`tab-btn ${importExportMode === "import" ? "active" : ""}`}
              onClick={() => setImportExportMode("import")}
              style={{ marginRight: "10px" }}
            >
              Import
            </button>
            <button
              className={`tab-btn ${importExportMode === "export" ? "active" : ""}`}
              onClick={() => setImportExportMode("export")}
            >
              Export
            </button>
          </div>

          {/* Import Section */}
          {importExportMode === "import" && (
            <div
              className="import-section"
              style={{ maxWidth: "800px", margin: "0 auto" }}
            >
              <div
                style={{ display: "flex", gap: "10px", marginBottom: "20px" }}
              >
                <button
                  className={`tab-btn ${reportType === "user" ? "active" : ""}`}
                  onClick={() => setReportType("user")}
                  style={{ fontSize: "14px", padding: "5px 15px" }}
                >
                  Import Users
                </button>
                <button
                  className={`tab-btn ${
                    reportType === "lesson" ? "active" : ""
                  }`}
                  onClick={() => setReportType("lesson")}
                  style={{ fontSize: "14px", padding: "5px 15px" }}
                >
                  Import Lessons
                </button>
              </div>

              <div
                className="drop-zone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    if (file.name.toLowerCase().endsWith(".csv")) {
                      setSelectedFile(file);
                    } else {
                      toast.error("Only .csv files are allowed!");
                    }
                  }
                }}
                style={{
                  border: "2px dashed #ccc",
                  borderRadius: "10px",
                  padding: "40px",
                  textAlign: "center",
                  backgroundColor: "#f9f9f9",
                  position: "relative",
                  marginBottom: "20px",
                }}
              >
                <div style={{ marginBottom: "20px" }}>
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#888"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <polyline points="9 15 12 12 15 15"></polyline>
                  </svg>
                </div>
                <h3 style={{ margin: "10px 0", color: "#333" }}>
                  Drop CSV here to upload
                </h3>

                <div style={{ margin: "20px 0" }}>
                  <input
                    id="file-input"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                  <button
                    onClick={() =>
                      document.getElementById("file-input")?.click()
                    }
                    style={{
                      backgroundColor: "#ff8c00",
                      color: "white",
                      border: "none",
                      padding: "10px 25px",
                      borderRadius: "5px",
                      fontSize: "16px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    }}
                  >
                    Select from device
                  </button>
                </div>

                {selectedFile ? (
                  <p style={{ color: "#4CAF50", fontWeight: "bold" }}>
                    Selected: {selectedFile.name}
                  </p>
                ) : (
                  <p style={{ color: "#888", fontSize: "12px" }}>
                    Up to 100 MB for CSV
                  </p>
                )}
              </div>

              <button
                className="run-btn"
                onClick={handleImport}
                disabled={loading || !selectedFile}
                style={{ width: "100%", padding: "15px", fontSize: "18px" }}
              >
                {loading ? "Uploading..." : "Upload File"}
              </button>

              <div
                style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}
              >
                {reportType === "user" ? (
                  <p>
                    <strong>Required Columns:</strong> email, first_name,
                    last_name, role
                  </p>
                ) : (
                  <p>
                    <strong>Required Columns:</strong> title, description,
                    course_id
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Export Section */}
          {importExportMode === "export" && (
            <div className="export-section">
              <h3>Export Reports</h3>
              <p style={{ color: "#666", marginBottom: "15px" }}>
                Export reports including courses, students, progress,
                attendance, and scores.
              </p>

              <div style={{ marginBottom: "15px" }}>
                <label
                  htmlFor="report-type"
                  style={{ marginRight: "10px", fontWeight: "bold" }}
                >
                  Report Type:
                </label>
                <select
                  id="report-type"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    fontSize: "14px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    minWidth: "200px",
                  }}
                >
                  <option value="students">Danh sách học viên</option>
                  <option value="courses">Danh sách khóa học</option>
                </select>
              </div>

              <button
                className="run-btn"
                onClick={handleExport}
                disabled={loading}
              >
                {loading ? "Exporting..." : "Export Report"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SqlPlayground;
