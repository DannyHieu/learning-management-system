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

// SQL definitions for MSSQL (LMS_DB)
// Source files: front-end/sql/MSSQL/STORED_PROCEDURES.sql, TRIGGERS.sql, FUNCTIONS.sql, CURSORS.sql
const storedProcedures: SqlOption[] = [
  {
    id: "sp1",
    name: "SP1: Đăng ký khóa học",
    sql: `/* SP1: Đăng ký khóa học cho học viên
   - Input: @student_id, @course_id
*/
CREATE OR ALTER PROCEDURE sp_RegisterCourse
    @student_id BIGINT,
    @course_id BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM Enrollment WHERE student_id = @student_id AND course_id = @course_id AND status = 'ACTIVE')
    BEGIN
        THROW 50001, 'Sinh viên đã đăng ký khóa học này.', 1;
        RETURN;
    END;
    INSERT INTO Enrollment (student_id, course_id, status, joined_at)
    VALUES (@student_id, @course_id, 'ACTIVE', SYSDATETIME());
    PRINT 'Đăng ký thành công!';
END;
-- TEST CASE:
-- 1) Đăng ký mới:
--    EXEC sp_RegisterCourse @student_id = 1, @course_id = 2;
--    SELECT * FROM Enrollment WHERE student_id = 1 AND course_id = 2;`,
  },
  {
    id: "sp2",
    name: "SP2: Cập nhật trạng thái đăng ký",
    sql: `/* SP2: Cập nhật trạng thái đăng ký
   - Chức năng: đổi trạng thái Enrollment ('ACTIVE' / 'REMOVED')
*/
CREATE OR ALTER PROCEDURE sp_UpdateEnrollmentStatus
    @enrollment_id BIGINT,
    @new_status    VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Enrollment SET status = @new_status WHERE enrollment_id = @enrollment_id;
END;
-- TEST CASE:
-- 1) Chuyển trạng thái sang REMOVED:
--    EXEC sp_UpdateEnrollmentStatus @enrollment_id = 1, @new_status = 'REMOVED';
--    SELECT * FROM Enrollment WHERE enrollment_id = 1;`,
  },
  {
    id: "sp3",
    name: "SP3: Ghi nhận điểm danh",
    sql: `/* SP3: Ghi nhận điểm danh buổi học
   - Input: @enrollment_id, @session_date, @status ('PRESENT' / 'ABSENT')
*/
CREATE OR ALTER PROCEDURE sp_TakeAttendance
    @enrollment_id BIGINT,
    @session_date  DATE,
    @status        VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    MERGE INTO Attendance AS Target
    USING (SELECT @enrollment_id AS enrollment_id, @session_date AS session_date) AS Source
    ON Target.enrollment_id = Source.enrollment_id AND Target.session_date = Source.session_date
    WHEN MATCHED THEN UPDATE SET status = @status
    WHEN NOT MATCHED THEN INSERT (enrollment_id, session_date, status) VALUES (@enrollment_id, @session_date, @status);
END;
-- TEST CASE:
-- 1) Điểm danh mới:
--    EXEC sp_TakeAttendance @enrollment_id = 1, @session_date = '2026-01-20', @status = 'PRESENT';
--    SELECT * FROM Attendance WHERE enrollment_id = 1;`,
  },
  {
    id: "sp4",
    name: "SP4: Nộp bài tập",
    sql: `/* SP4: Nộp bài tập và lưu lịch sử nộp
*/
CREATE OR ALTER PROCEDURE sp_SubmitAssignment
    @assignment_id BIGINT,
    @student_id    BIGINT,
    @file_url      VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM Submission WHERE assignment_id = @assignment_id AND student_id = @student_id)
    BEGIN
        UPDATE Submission SET file_url = @file_url, submitted_at = SYSDATETIME()
        WHERE assignment_id = @assignment_id AND student_id = @student_id;
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
--    SELECT * FROM Submission WHERE assignment_id = 1 AND student_id = 1;`,
  },
  {
    id: "sp5",
    name: "SP5: Cập nhật tiến độ học tập",
    sql: `/* SP5: Cập nhật tiến độ học tập của học viên trong khóa
*/
CREATE OR ALTER PROCEDURE sp_UpdateStudentProgress
    @course_id  BIGINT,
    @student_id BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @total_assign INT, @done_assign INT, @percent DECIMAL(5,2);
    SELECT @total_assign = COUNT(*) FROM Assignment WHERE course_id = @course_id;
    SELECT @done_assign = COUNT(*) FROM Submission s JOIN Assignment a ON s.assignment_id = a.assignment_id
    WHERE a.course_id = @course_id AND s.student_id = @student_id;
    SET @percent = CASE WHEN @total_assign = 0 THEN 100 ELSE (@done_assign * 100.0) / @total_assign END;
    UPDATE Enrollment SET progress = @percent WHERE course_id = @course_id AND student_id = @student_id;
END;
-- TEST CASE:
-- 1) Cập nhật tiến độ:
--    EXEC sp_UpdateStudentProgress @course_id = 1, @student_id = 1;
--    SELECT * FROM Enrollment WHERE course_id = 1 AND student_id = 1;`,
  },
];

const triggers: SqlOption[] = [
  {
    id: "t1",
    name: "T1: Mã hóa mật khẩu",
    sql: `/* T1: Trigger mã hóa mật khẩu trước khi insert User
*/
CREATE OR ALTER TRIGGER tr_EncryptPassword
ON Users INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO Users (email, password_hash, first_name, last_name, role, status, created_at)
    SELECT email, CONVERT(VARCHAR(255), HASHBYTES('SHA2_256', password_hash), 2), first_name, last_name, role, status, created_at FROM inserted;
END;
-- TEST CASE:
-- 1) Insert user mới:
--    INSERT INTO Users (email, password_hash, first_name, last_name, role, status) VALUES ('test@lms.com', 'PlainPassword', N'Test', N'User', 'STUDENT', 'ACTIVE');
--    SELECT * FROM Users WHERE email = 'test@lms.com';`,
  },
  {
    id: "t2",
    name: "T2: Chặn đăng ký trùng",
    sql: `/* T2: Trigger kiểm tra không cho đăng ký trùng khóa học
*/
CREATE OR ALTER TRIGGER tr_CheckDuplicateEnrollment
ON Enrollment AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT student_id, course_id, COUNT(*) FROM Enrollment WHERE status = 'ACTIVE' GROUP BY student_id, course_id HAVING COUNT(*) > 1)
    BEGIN
        RAISERROR('Học viên đã đăng ký khóa học này rồi!', 16, 1);
        ROLLBACK TRANSACTION;
    END;
END;
-- TEST CASE:
-- 1) Thử insert trùng:
--    INSERT INTO Enrollment (course_id, student_id, status) VALUES (1, 1, 'ACTIVE');`,
  },
  {
    id: "t3",
    name: "T3: Cập nhật số lượng học viên",
    sql: `/* T3: Trigger cập nhật số lượng học viên của khóa học
*/
CREATE OR ALTER TRIGGER tr_UpdateStudentCount
ON Enrollment AFTER INSERT, DELETE, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE C SET C.student_count = (SELECT COUNT(*) FROM Enrollment E WHERE E.course_id = C.course_id AND E.status = 'ACTIVE')
    FROM Course C WHERE C.course_id IN (SELECT course_id FROM inserted UNION SELECT course_id FROM deleted);
END;
-- TEST CASE:
-- 1) Thêm Enrollment:
--    INSERT INTO Enrollment (course_id, student_id, status) VALUES (1, 5, 'ACTIVE');
--    SELECT * FROM Course WHERE course_id = 1;`,
  },
  {
    id: "t4",
    name: "T4: Đánh dấu bài nộp trễ hạn",
    sql: `/* T4: Trigger đánh dấu bài nộp trễ hạn
*/
CREATE OR ALTER TRIGGER tr_MarkLateSubmission
ON Submission AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE S SET is_late = 1 FROM Submission S JOIN inserted I ON S.submission_id = I.submission_id
    JOIN Assignment A ON I.assignment_id = A.assignment_id WHERE I.submitted_at > A.deadline;
END;
-- TEST CASE:
-- 1) Nộp bài sau deadline:
--    INSERT INTO Submission (assignment_id, student_id, file_url, submitted_at) VALUES (1, 1, '/submit/late.pdf', DATEADD(DAY, 10, GETDATE()));
--    SELECT * FROM Submission WHERE file_url = '/submit/late.pdf';`,
  },
  {
    id: "t5",
    name: "T5: Tự động cập nhật tiến độ",
    sql: `/* T5: Trigger tự động cập nhật tiến độ khi có Submission
*/
CREATE OR ALTER TRIGGER tr_AutoUpdateProgress
ON Submission AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @course_id BIGINT, @student_id BIGINT;
    SELECT TOP 1 @student_id = I.student_id, @course_id = A.course_id FROM inserted I JOIN Assignment A ON I.assignment_id = A.assignment_id;
    IF @course_id IS NOT NULL AND @student_id IS NOT NULL
        EXEC sp_UpdateStudentProgress @course_id = @course_id, @student_id = @student_id;
END;
-- TEST CASE:
-- 1) Update nộp bài:
--    UPDATE Submission SET score = 9.0 WHERE submission_id = 1;
--    SELECT * FROM Enrollment WHERE enrollment_id = 1;`,
  },
];

const functions: SqlOption[] = [
  {
    id: "f1",
    name: "F1: Tỷ lệ điểm danh",
    sql: `/* F1: Tính tỷ lệ điểm danh của học viên theo khóa
*/
CREATE OR ALTER FUNCTION fn_AttendanceRate (@enrollment_id BIGINT)
RETURNS DECIMAL(5,2) AS
BEGIN
    DECLARE @total_sessions INT, @present_sessions INT;
    SELECT @total_sessions = COUNT(*) FROM Attendance WHERE enrollment_id = @enrollment_id;
    SELECT @present_sessions = COUNT(*) FROM Attendance WHERE enrollment_id = @enrollment_id AND status = 'PRESENT';
    RETURN CASE WHEN @total_sessions = 0 THEN 100.0 ELSE (@present_sessions * 100.0) / @total_sessions END;
END;
-- TEST CASE:
-- 1) Tính tỷ lệ điểm danh:
--    SELECT dbo.fn_AttendanceRate(1) AS AttendanceRate;`,
  },
  {
    id: "f2",
    name: "F2: Tỷ lệ hoàn thành bài tập",
    sql: `/* F2: Tính tỷ lệ hoàn thành bài tập của học viên trong khóa
*/
CREATE OR ALTER FUNCTION fn_AssignmentCompletion (@student_id BIGINT, @course_id BIGINT)
RETURNS DECIMAL(5,2) AS
BEGIN
    DECLARE @total INT, @submitted INT;
    SELECT @total = COUNT(*) FROM Assignment WHERE course_id = @course_id;
    SELECT @submitted = COUNT(*) FROM Submission s JOIN Assignment a ON s.assignment_id = a.assignment_id
    WHERE a.course_id = @course_id AND s.student_id = @student_id;
    RETURN CASE WHEN @total = 0 THEN 100.0 ELSE (@submitted * 100.0) / @total END;
END;
-- TEST CASE:
-- 1) Tính tỷ lệ hoàn thành:
--    SELECT dbo.fn_AssignmentCompletion(1, 1) AS AssignmentCompletion;`,
  },
  {
    id: "f3",
    name: "F3: Tiến độ tổng hợp",
    sql: `/* F3: Tính tiến độ tổng hợp (progress_percent)
*/
CREATE OR ALTER FUNCTION fn_TotalProgress (@enrollment_id BIGINT)
RETURNS DECIMAL(5,2) AS
BEGIN
    DECLARE @att_rate DECIMAL(5,2), @assign_rate DECIMAL(5,2), @student_id BIGINT, @course_id BIGINT;
    SELECT @student_id = student_id, @course_id = course_id FROM Enrollment WHERE enrollment_id = @enrollment_id;
    SET @att_rate = dbo.fn_AttendanceRate(@enrollment_id);
    SET @assign_rate = dbo.fn_AssignmentCompletion(@student_id, @course_id);
    RETURN (@att_rate * 0.3) + (@assign_rate * 0.7);
END;
-- TEST CASE:
-- 1) Tính tiến độ tổng hợp:
--    SELECT dbo.fn_TotalProgress(1) AS TotalProgress;`,
  },
];

const cursors: SqlOption[] = [
  {
    id: "c1",
    name: "C1: Cập nhật tiến độ hàng loạt",
    sql: `/* C1: Cursor cập nhật tiến độ hàng loạt cho 1 khóa
*/
CREATE OR ALTER PROCEDURE sp_BatchUpdateProgress_Cursor @course_id BIGINT AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @s_id BIGINT;
    DECLARE cur_progress CURSOR FOR SELECT student_id FROM Enrollment WHERE course_id = @course_id;
    OPEN cur_progress;
    FETCH NEXT FROM cur_progress INTO @s_id;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC sp_UpdateStudentProgress @course_id = @course_id, @student_id = @s_id;
        FETCH NEXT FROM cur_progress INTO @s_id;
    END;
    CLOSE cur_progress; DEALLOCATE cur_progress;
END;
-- TEST CASE:
-- 1) Chạy cập nhật hàng loạt:
--    EXEC sp_BatchUpdateProgress_Cursor @course_id = 1;
--    SELECT * FROM Enrollment WHERE course_id = 1;`,
  },
  {
    id: "c2",
    name: "C2: Báo cáo tổng hợp khóa học",
    sql: `/* C2: Cursor tạo báo cáo tổng hợp theo từng khóa
*/
CREATE OR ALTER PROCEDURE sp_CourseReport_Cursor AS
BEGIN
    SET NOCOUNT ON;
    CREATE TABLE #Report (CourseName NVARCHAR(255), StudentCount INT, AvgProgress DECIMAL(5,2));
    DECLARE @c_id BIGINT, @c_name NVARCHAR(255), @s_count INT, @avg_prog DECIMAL(5,2);
    DECLARE cur_report CURSOR FOR SELECT course_id, name FROM Course;
    OPEN cur_report;
    FETCH NEXT FROM cur_report INTO @c_id, @c_name;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SELECT @s_count = COUNT(*) FROM Enrollment WHERE course_id = @c_id AND status = 'ACTIVE';
        SELECT @avg_prog = AVG(progress) FROM Enrollment WHERE course_id = @c_id;
        INSERT INTO #Report VALUES (@c_name, @s_count, ISNULL(@avg_prog, 0));
        FETCH NEXT FROM cur_report INTO @c_id, @c_name;
    END;
    CLOSE cur_report; DEALLOCATE cur_report;
    SELECT * FROM #Report; DROP TABLE #Report;
END;
-- TEST CASE:
-- 1) Xem báo cáo tổng hợp:
--    EXEC sp_CourseReport_Cursor;`,
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
  const [testCaseCode, setTestCaseCode] = useState<string>("");
  const [testCaseTitle, setTestCaseTitle] = useState<string>("");
  const [definitionCode, setDefinitionCode] = useState<string>("");
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

  const parseSqlOption = (fullSql: string) => {
    const marker = "-- TEST CASE:";
    const index = fullSql.indexOf(marker);
    if (index === -1) return { mainSql: fullSql, testCase: "", title: "" };

    const mainSql = fullSql.substring(0, index).trim();
    const testPart = fullSql.substring(index + marker.length).trim();

    // Extract first case: look for "-- 1)" or "-- [LABEL]:"
    // Handles matches like "-- 1) Description\nSQL" or "-- SP1: Description\nSQL"
    const firstMatch = testPart.match(
      /(?:--\s*(?:1\)|[A-Z0-9]+:))([\s\S]*?)(?=--\s*(?:[2-9]\)|[A-Z0-9]+:)|$)/i,
    );
    let testCaseRaw = firstMatch ? firstMatch[1].trim() : testPart;

    // Split into lines to extract title and uncomment the SQL statements
    const lines = testCaseRaw.split("\n");
    const testCaseTitle = lines[0].trim();
    const remainingLines = lines.slice(1);

    const cleanedLines = remainingLines.map((line) => {
      // regex to match leading comment dashes followed by SQL keywords
      const sqlKeywordRegex =
        /^\s*--\s*(EXEC|SELECT|INSERT|UPDATE|DELETE|WITH|SET|DECLARE|IF|BEGIN|END|PRINT|MERGE|GO)/i;
      if (sqlKeywordRegex.test(line)) {
        return line.replace(/^\s*--\s*/, "");
      }
      return line;
    });

    return {
      mainSql,
      testCase: cleanedLines.join("\n").trim(),
      title: testCaseTitle,
    };
  };

  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);
    setError(null);
    setResults([]);

    if (tabId === "importExport") {
      setImportExportMode("import");
      setReportType("user");
      setDefinitionCode("");
      setTestCaseCode("");
      setTestCaseTitle("");
    } else {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab && tab.options.length > 0) {
        const firstOption = tab.options[0];
        setSelectedOption(firstOption.id);
        const { mainSql, testCase, title } = parseSqlOption(firstOption.sql);
        setDefinitionCode(mainSql);
        setTestCaseCode(testCase);
        setTestCaseTitle(title);
      }
    }
  };

  const handleOptionChange = (optionId: string) => {
    setSelectedOption(optionId);
    const tab = tabs.find((t) => t.id === activeTab);
    const option = tab?.options.find((opt) => opt.id === optionId);
    if (option) {
      const { mainSql, testCase, title } = parseSqlOption(option.sql);
      setDefinitionCode(mainSql);
      setTestCaseCode(testCase);
      setTestCaseTitle(title);
    }
  };

  const handleRunSql = async () => {
    if (!testCaseCode.trim()) {
      toast.error("Test Case is empty!");
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
        body: testCaseCode,
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
        toast.info(data.message || "SQL executed, no results returned.");
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
      const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}_report_${dateStr}.csv`;
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

  // Initial state logic
  React.useEffect(() => {
    if (activeTab !== "importExport") {
      const tab = tabs.find((t) => t.id === activeTab);
      const option = tab?.options.find((opt) => opt.id === selectedOption);
      if (option) {
        const { mainSql, testCase, title } = parseSqlOption(option.sql);
        setDefinitionCode(mainSql);
        setTestCaseCode(testCase);
        setTestCaseTitle(title);
      }
    }
  }, []);

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
              {loading ? "Running..." : "Run Test Case »"}
            </button>
          </div>

          {/* SQL Editors */}
          <div
            className="editors-flex-container"
            style={{
              display: "flex",
              gap: "20px",
              marginBottom: "25px",
            }}
          >
            {/* Left: Test Case (Editable) */}
            <div className="editor-wrapper" style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>
                TEST CASE: {testCaseTitle}
              </h3>
              <div
                className="editor-container"
                style={{ margin: 0, padding: "10px" }}
              >
                <textarea
                  className="sql-editor"
                  value={testCaseCode}
                  onChange={(e) => setTestCaseCode(e.target.value)}
                  spellCheck={false}
                  style={{ height: "450px" }}
                />
              </div>
            </div>

            {/* Right: Definition (Read-only) */}
            <div className="editor-wrapper" style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>SQL</h3>
              <div
                className="editor-container"
                style={{
                  margin: 0,
                  padding: "10px",
                  backgroundColor: "#f5f5f5",
                }}
              >
                <textarea
                  className="sql-editor"
                  value={definitionCode}
                  readOnly
                  spellCheck={false}
                  style={{
                    height: "450px",
                    backgroundColor: "#2e2e2e",
                    color: "#a9dc76", // Greenish tint for code view
                    cursor: "not-allowed",
                  }}
                />
              </div>
            </div>
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
                  Import Student
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
                    last_name
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
