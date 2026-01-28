## Hướng dẫn chạy SQL cho hệ thống LMS (SQL Server)

**Môi trường**: Microsoft SQL Server (SSMS / Azure Data Studio / DBeaver với driver SQL Server).  
**Database**: `LMS_DB`  
**Các file chính** (trong `back-end/src/main/resources/sql`):

- `insert.sql`: Tạo database, bảng, dữ liệu mẫu
- `STORED_PROCEDURES.sql`: Stored Procedure (SP1–SP5)
- `TRIGGERS.sql`: Trigger (T1–T5)
- `FUNCTIONS.sql`: Function (F1–F3)
- `CURSORS.sql`: Cursor / Stored procedure liên quan (C1–C2)

---

### 1. Thứ tự chạy tổng quát

1. **Chạy `insert.sql`**  
   - Tạo mới database `LMS_DB` (drop nếu đã tồn tại)  
   - Tạo toàn bộ bảng: `Users`, `Student`, `Teacher`, `Course`, `Enrollment`, `Lesson`, `Material`, `Assignment`, `Submission`, `Attendance`, `Announcement`  
   - Insert dữ liệu mẫu cho tất cả bảng trên

2. **Chạy `STORED_PROCEDURES.sql`**  
   - Tạo/cập nhật các stored procedure:
     - `sp_RegisterCourse`
     - `sp_UpdateEnrollmentStatus`
     - `sp_TakeAttendance`
     - `sp_SubmitAssignment`
     - `sp_UpdateStudentProgress` (kèm thêm cột `Enrollment.progress` nếu chưa có)

3. **Chạy `FUNCTIONS.sql`**  
   - Tạo/cập nhật các function:
     - `fn_AttendanceRate`
     - `fn_AssignmentCompletion`
     - `fn_TotalProgress`

4. **Chạy `TRIGGERS.sql`**  
   - Tạo/cập nhật các trigger:
     - `tr_EncryptPassword` trên `Users`
     - `tr_CheckDuplicateEnrollment` trên `Enrollment`
     - `tr_UpdateStudentCount` trên `Enrollment` (cập nhật `Course.student_count`, tự thêm cột nếu thiếu)
     - `tr_MarkLateSubmission` trên `Submission` (tự thêm cột `is_late` nếu thiếu)
     - `tr_AutoUpdateProgress` trên `Submission` (gọi `sp_UpdateStudentProgress`)

5. **Chạy `CURSORS.sql`**  
   - Tạo/cập nhật các stored procedure dùng cursor:
     - `sp_BatchUpdateProgress_Cursor` (C1)
     - `sp_CourseReport_Cursor` (C2)

---

### 2. Hướng dẫn chi tiết từng bước

#### Bước 1: Chạy `insert.sql`

1. Mở **SSMS** (hoặc tool tương đương), kết nối tới SQL Server.
2. Mở file `insert.sql`.
3. **Chạy toàn bộ file**:
   - Đảm bảo bạn đang kết nối ở context `master` (vì script có phần `DROP DATABASE` + `CREATE DATABASE`).
   - Script sẽ:
     - Drop database `LMS_DB` nếu tồn tại.
     - Tạo mới `LMS_DB`.
     - `USE LMS_DB;` và tạo toàn bộ bảng.
     - Insert dữ liệu mẫu.
4. Kiểm tra nhanh:

```sql
USE LMS_DB;
GO
SELECT TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

SELECT 'Users' AS TableName, COUNT(*) AS RecordCount FROM Users
UNION ALL SELECT 'Teacher', COUNT(*) FROM Teacher
UNION ALL SELECT 'Student', COUNT(*) FROM Student
UNION ALL SELECT 'Course', COUNT(*) FROM Course
UNION ALL SELECT 'Enrollment', COUNT(*) FROM Enrollment;
```

Nếu các bảng và số lượng bản ghi giống như cuối file `insert.sql` thì DB đã OK.

---

#### Bước 2: Chạy `STORED_PROCEDURES.sql`

1. Đảm bảo đang `USE LMS_DB;` (file đã có lệnh này đầu file).  
2. Mở `STORED_PROCEDURES.sql` và **chạy toàn bộ script** (Ctrl + A → F5).
3. Kiểm tra tạo thành công bằng cách chạy một số test trong file, ví dụ:

```sql
-- Đăng ký khóa học mới cho sinh viên 1 vào khóa 2
EXEC sp_RegisterCourse @student_id = 1, @course_id = 2;
SELECT * FROM Enrollment WHERE student_id = 1 AND course_id = 2;
```

Nếu thấy bản ghi mới trong `Enrollment` là SP1 hoạt động đúng.

---

#### Bước 3: Chạy `FUNCTIONS.sql`

1. Mở `FUNCTIONS.sql` (đầu file cũng có `USE LMS_DB;`).  
2. Chạy toàn bộ script.  
3. Test nhanh:

```sql
-- Tỷ lệ điểm danh cho enrollment_id = 1
SELECT dbo.fn_AttendanceRate(1) AS AttendanceRate_Enroll1;

-- Tỷ lệ hoàn thành bài tập cho student 1, course 1
SELECT dbo.fn_AssignmentCompletion(1, 1) AS AssignmentCompletion_Student1_Course1;

-- Tiến độ tổng hợp cho enrollment 1
SELECT dbo.fn_TotalProgress(1) AS TotalProgress_Enroll1;
```

Nếu trả về giá trị DECIMAL(5,2) hợp lý, function đã OK.

---

#### Bước 4: Chạy `TRIGGERS.sql`

1. Mở `TRIGGERS.sql` (đảm bảo đang chạy trên `LMS_DB`).  
2. Chạy toàn bộ script.  
3. Test nhanh từng trigger (có đoạn test mẫu cuối file, có thể copy từng khối):

- **T1 – tr_EncryptPassword**:

```sql
INSERT INTO Users (email, password_hash, first_name, last_name, role, status)
VALUES ('test_hash@lms.com', 'PlainPassword', N'Test', N'User', 'STUDENT', 'ACTIVE');

SELECT email, password_hash FROM Users WHERE email = 'test_hash@lms.com';
-- password_hash phải là chuỗi hex (đã HASHBYTES), không phải 'PlainPassword'
```

- **T2 – tr_CheckDuplicateEnrollment**: thử insert Enrollment trùng (course_id, student_id) và xem có RAISERROR + rollback hay không.
- **T3 – tr_UpdateStudentCount**: insert/xóa Enrollment rồi `SELECT * FROM Course` để xem `student_count` thay đổi.
- **T4 – tr_MarkLateSubmission**: insert Submission với `submitted_at > deadline` để xem `is_late = 1`.
- **T5 – tr_AutoUpdateProgress**: update/insert Submission rồi kiểm tra `Enrollment.progress` có được cập nhật qua SP5 hay không.

---

#### Bước 5: Chạy `CURSORS.sql`

1. Mở `CURSORS.sql` (cũng có `USE LMS_DB;`).  
2. Chạy toàn bộ script.  
3. Test nhanh:

```sql
-- C1: cập nhật progress hàng loạt cho khóa 1
EXEC sp_BatchUpdateProgress_Cursor @course_id = 1;
SELECT * FROM Enrollment WHERE course_id = 1;

-- C2: báo cáo tổng hợp cho tất cả khóa học
EXEC sp_CourseReport_Cursor;
```

`sp_CourseReport_Cursor` sẽ trả về bảng thống kê tạm gồm: tên khóa, số học viên ACTIVE, tiến độ trung bình.

---

### 3. Gợi ý kiểm thử end-to-end

Sau khi chạy xong tất cả file, bạn có thể kiểm tra luồng nghiệp vụ hoàn chỉnh:

1. **Đăng ký khóa học mới** bằng `sp_RegisterCourse`.  
2. **Điểm danh** một vài buổi bằng `sp_TakeAttendance`.  
3. **Nộp bài** bằng `sp_SubmitAssignment` (trước/sau deadline).  
4. Xem **progress** cập nhật tự động nhờ trigger `tr_AutoUpdateProgress` + `sp_UpdateStudentProgress`.  
5. Chạy `sp_CourseReport_Cursor` để lấy báo cáo tổng hợp cuối cùng.

Nếu tất cả các bước trên chạy được, nghĩa là toàn bộ script SQL (insert + SP + Trigger + Function + Cursor) đã được import và hoạt động đúng trên `LMS_DB`.


