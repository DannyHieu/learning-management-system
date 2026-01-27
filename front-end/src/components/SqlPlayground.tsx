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
const storedProcedures: SqlOption[] = [
  {
    id: "sp1",
    name: "SP1: Đăng ký khóa học cho học viên",
    sql: `CREATE PROCEDURE RegisterCourse(
    IN p_student_id INT,
    IN p_course_id INT
)
BEGIN
    INSERT INTO Enrollments (student_id, course_id, status)
    VALUES (p_student_id, p_course_id, 'Registered');
END;`,
  },
  {
    id: "sp2",
    name: "SP2: Cập nhật trạng thái đăng ký",
    sql: `CREATE PROCEDURE UpdateRegistrationStatus(
    IN p_registration_id INT,
    IN p_new_status VARCHAR(50)
)
BEGIN
    UPDATE Enrollments
    SET status = p_new_status
    WHERE id = p_registration_id;
END;`,
  },
  {
    id: "sp3",
    name: "SP3: Ghi nhận điểm danh buổi học",
    sql: `CREATE PROCEDURE RecordAttendance(
    IN p_student_id INT,
    IN p_session_id INT
)
BEGIN
    INSERT INTO Attendance (student_id, session_id, attended, date)
    VALUES (p_student_id, p_session_id, 1, NOW());
END;`,
  },
  {
    id: "sp4",
    name: "SP4: Nộp bài tập và lưu lịch sử nộp",
    sql: `CREATE PROCEDURE SubmitAssignment(
    IN p_student_id INT,
    IN p_assignment_id INT,
    IN p_file_path VARCHAR(255)
)
BEGIN
    INSERT INTO Submissions (student_id, assignment_id, file_path, submitted_at)
    VALUES (p_student_id, p_assignment_id, p_file_path, NOW());
    INSERT INTO SubmissionHistory (submission_id, event, timestamp)
    VALUES (LAST_INSERT_ID(), 'Submitted', NOW());
END;`,
  },
  {
    id: "sp5",
    name: "SP5: Cập nhật tiến độ học tập của học viên trong khóa",
    sql: `CREATE PROCEDURE UpdateProgress(
    IN p_student_id INT,
    IN p_course_id INT,
    IN p_new_progress FLOAT
)
BEGIN
    UPDATE CourseProgress
    SET progress = p_new_progress
    WHERE student_id = p_student_id
      AND course_id = p_course_id;
END;`,
  },
];

const triggers: SqlOption[] = [
  {
    id: "t1",
    name: "T1: Mã hóa mật khẩu trước khi insert/update User",
    sql: `CREATE TRIGGER encrypt_password_before_insert
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
END;`,
  },
  {
    id: "t2",
    name: "T2: Kiểm tra không cho đăng ký trùng khóa học",
    sql: `CREATE TRIGGER no_duplicate_registration
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
END;`,
  },
  {
    id: "t3",
    name: "T3: Cập nhật số lượng học viên của khóa học",
    sql: `CREATE TRIGGER update_course_count_after_insert
AFTER INSERT ON Enrollments
FOR EACH ROW
BEGIN
    UPDATE Courses
    SET student_count = student_count + 1
    WHERE id = NEW.course_id;
END;`,
  },
  {
    id: "t4",
    name: "T4: Đánh dấu bài nộp trễ hạn",
    sql: `CREATE TRIGGER mark_late_submission
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
END;`,
  },
  {
    id: "t5",
    name: "T5: Tự động cập nhật tiến độ khi có sự kiện liên quan",
    sql: `CREATE TRIGGER update_progress_after_attendance
AFTER INSERT ON Attendance
FOR EACH ROW
BEGIN
    UPDATE CourseProgress
    SET progress = progress + 5
    WHERE student_id = NEW.student_id 
      AND course_id = NEW.course_id;
END;`,
  },
];

const functions: SqlOption[] = [
  {
    id: "f1",
    name: "F1: Tính tỷ lệ điểm danh của học viên theo khóa",
    sql: `CREATE FUNCTION AttendanceRate(
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
END;`,
  },
  {
    id: "f2",
    name: "F2: Tính tỷ lệ hoàn thành bài tập",
    sql: `CREATE FUNCTION AssignmentCompletionRate(
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
END;`,
  },
  {
    id: "f3",
    name: "F3: Tính tiến độ tổng hợp",
    sql: `CREATE FUNCTION OverallProgress(
    p_student_id INT,
    p_course_id INT
) RETURNS FLOAT
BEGIN
    DECLARE attendance_rate FLOAT;
    DECLARE assignment_rate FLOAT;
    SET attendance_rate = AttendanceRate(p_student_id, p_course_id);
    SET assignment_rate = AssignmentCompletionRate(p_student_id, p_course_id);
    RETURN (attendance_rate + assignment_rate) / 2;
END;`,
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
