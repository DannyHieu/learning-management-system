package com.example.back_end;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.Scanner;
import java.util.*;

@Service
public class ImportService {

    private final JdbcTemplate jdbcTemplate;

    public ImportService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> importFile(MultipartFile file, String type) throws Exception {
        String fileName = file.getOriginalFilename();
        if (fileName == null)
            throw new IllegalArgumentException("File name is null");

        if (!fileName.toLowerCase().endsWith(".csv")) {
            throw new IllegalArgumentException("Only .csv files are allowed.");
        }

        List<Map<String, String>> data = parseCSV(file.getInputStream());

        if (data.isEmpty()) {
            throw new IllegalArgumentException("File is empty.");
        }

        if ("user".equalsIgnoreCase(type)) {
            return importUsers(data);
        } else if ("course".equalsIgnoreCase(type) || "lesson".equalsIgnoreCase(type)) {
            return importLessons(data);
        } else {
            throw new IllegalArgumentException("Invalid import type.");
        }
    }

    private List<Map<String, String>> parseCSV(InputStream is) throws Exception {
        List<Map<String, String>> result = new ArrayList<>();
        try (Scanner scanner = new Scanner(is)) {
            if (!scanner.hasNextLine())
                return result;

            String headerLine = scanner.nextLine();
            if (headerLine == null || headerLine.trim().isEmpty())
                return result;

            // Detect delimiter: count commas vs tabs
            long commaCount = headerLine.chars().filter(ch -> ch == ',').count();
            long tabCount = headerLine.chars().filter(ch -> ch == '\t').count();
            String delimiter = (tabCount > commaCount) ? "\\t" : ",";

            // Split headers and clean them
            String[] headers = headerLine.split(delimiter);
            for (int i = 0; i < headers.length; i++) {
                headers[i] = headers[i].trim().toLowerCase().replaceAll("^\"|\"$", "");
            }

            while (scanner.hasNextLine()) {
                String line = scanner.nextLine();
                if (line.trim().isEmpty())
                    continue;

                // Split values using the detected delimiter
                // If comma, handling quotes. if tab, simple split is usually enough
                String[] values;
                if (",".equals(delimiter)) {
                    values = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
                } else {
                    values = line.split("\t");
                }

                Map<String, String> row = new HashMap<>();
                for (int i = 0; i < headers.length; i++) {
                    String val = (i < values.length) ? values[i] : "";
                    val = val.trim().replaceAll("^\"|\"$", "").replace("\"\"", "\"");
                    row.put(headers[i], val);
                }
                result.add(row);
            }
        }
        return result;
    }

    private Map<String, Object> importUsers(List<Map<String, String>> data) {
        String[] required = { "email" }; // email is the only hard requirement now
        validateHeaders(data.get(0), required);

        int count = 0;
        int skippedCount = 0;
        List<String> duplicates = new ArrayList<>();

        for (Map<String, String> row : data) {
            String email = row.get("email");
            String firstName = row.get("first_name") != null ? row.get("first_name") : "";
            String lastName = row.get("last_name") != null ? row.get("last_name") : "";

            // Skip only if email is globally missing/blank
            if (email == null || email.isBlank()) {
                skippedCount++;
                continue;
            }

            Integer existing = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM Users WHERE email = ?", Integer.class,
                    email);

            if (existing != null && existing > 0) {
                duplicates.add(email);
                continue;
            }

            // Using SYSDATETIME() for MSSQL datetime2 compatibility
            jdbcTemplate.update(
                    "INSERT INTO Users (email, first_name, last_name, role, password_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?, SYSDATETIME())",
                    email, firstName, lastName, "STUDENT", "Password123", "ACTIVE");
            count++;
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        String msg = "Successfully imported " + count + " students.";
        if (skippedCount > 0) {
            msg += " Ignored " + skippedCount + " empty rows.";
        }
        if (!duplicates.isEmpty()) {
            msg += " Skipped " + duplicates.size() + " duplicates.";
        }
        res.put("message", msg);
        return res;
    }

    private Map<String, Object> importLessons(List<Map<String, String>> data) {
        String[] required = { "title", "course_id" };
        validateHeaders(data.get(0), required);

        int count = 0;
        int updated = 0;
        int skippedCount = 0;
        for (Map<String, String> row : data) {
            String title = row.get("title");
            String courseId = row.get("course_id");
            String lessonIdStr = row.get("lesson_id");
            String desc = row.get("description");
            if (desc == null)
                desc = "";

            if (title == null || title.isBlank() || courseId == null || courseId.isBlank()) {
                skippedCount++;
                continue;
            }

            // Check if exists: by lesson_id or (course_id + title)
            Integer existingId = null;
            if (lessonIdStr != null && !lessonIdStr.isBlank()) {
                try {
                    existingId = jdbcTemplate.queryForObject("SELECT lesson_id FROM Lesson WHERE lesson_id = ?",
                            Integer.class, lessonIdStr);
                } catch (Exception e) {
                    /* ignored */ }
            }
            if (existingId == null) {
                try {
                    existingId = jdbcTemplate.queryForObject(
                            "SELECT lesson_id FROM Lesson WHERE course_id = ? AND title = ?",
                            Integer.class, courseId, title);
                } catch (Exception e) {
                    /* ignored */ }
            }

            if (existingId != null) {
                jdbcTemplate.update("UPDATE Lesson SET description = ? WHERE lesson_id = ?", desc, existingId);
                updated++;
            } else {
                jdbcTemplate.update("INSERT INTO Lesson (title, description, course_id) VALUES (?, ?, ?)", title, desc,
                        courseId);
                count++;
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        String msg = "Imported " + count + " new lessons, updated " + updated + " existing.";
        if (skippedCount > 0)
            msg += " Ignored " + skippedCount + " incomplete rows.";
        res.put("message", msg);
        return res;
    }

    private void validateHeaders(Map<String, String> firstRow, String[] required) {
        List<String> missing = new ArrayList<>();
        for (String col : required) {
            if (!firstRow.containsKey(col)) {
                missing.add(col);
            }
        }
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("Missing required columns: " + String.join(", ", missing));
        }
    }

    public String exportToCSV(String type) throws Exception {
        String query;
        if ("students".equalsIgnoreCase(type) || "user".equalsIgnoreCase(type)) {
            query = "SELECT email, first_name, last_name, role, created_at FROM Users WHERE role = 'STUDENT'";
        } else if ("courses".equalsIgnoreCase(type) || "lesson".equalsIgnoreCase(type)) {
            query = "SELECT title, description FROM Lesson";
        } else {
            throw new IllegalArgumentException("Invalid export type.");
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(query);
        StringBuilder sb = new StringBuilder();

        if (rows.isEmpty()) {
            if ("students".equalsIgnoreCase(type) || "user".equalsIgnoreCase(type)) {
                return "email,first_name,last_name,role,created_at\n";
            } else {
                return "title,description\n";
            }
        }

        // Headers
        String[] headers = rows.get(0).keySet().toArray(new String[0]);
        sb.append(String.join(",", headers)).append("\n");

        // Data
        for (Map<String, Object> row : rows) {
            List<String> values = new ArrayList<>();
            for (String header : headers) {
                Object val = row.get(header);
                String strVal = val != null ? val.toString() : "";
                // basic escaping: wrap in quotes if contains comma, quote or newline
                if (strVal.contains(",") || strVal.contains("\"") || strVal.contains("\n")) {
                    strVal = "\"" + strVal.replace("\"", "\"\"") + "\"";
                }
                values.add(strVal);
            }
            sb.append(String.join(",", values)).append("\n");
        }
        return sb.toString();
    }
}
