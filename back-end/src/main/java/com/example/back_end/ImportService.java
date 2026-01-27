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
            String[] headers = headerLine.split(",");
            for (int i = 0; i < headers.length; i++) {
                headers[i] = headers[i].trim().toLowerCase().replaceAll("^\"|\"$", "");
            }

            while (scanner.hasNextLine()) {
                String line = scanner.nextLine();
                if (line.trim().isEmpty())
                    continue;
                // Regex to split by comma but ignore commas inside quotes
                String[] values = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
                Map<String, String> row = new HashMap<>();
                for (int i = 0; i < headers.length && i < values.length; i++) {
                    String val = values[i].trim().replaceAll("^\"|\"$", "").replace("\"\"", "\"");
                    row.put(headers[i], val);
                }
                result.add(row);
            }
        }
        return result;
    }

    private Map<String, Object> importUsers(List<Map<String, String>> data) {
        String[] required = { "email", "first_name", "last_name", "role" };
        validateHeaders(data.get(0), required);

        int count = 0;
        List<String> skipped = new ArrayList<>();
        for (Map<String, String> row : data) {
            String email = row.get("email");
            Integer existing = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM Users WHERE email = ?", Integer.class,
                    email);

            if (existing != null && existing > 0) {
                skipped.add(email);
                continue;
            }

            jdbcTemplate.update(
                    "INSERT INTO Users (email, first_name, last_name, role, password_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    email,
                    row.get("first_name"),
                    row.get("last_name"),
                    row.get("role"),
                    "Password123", // Default password, trigger will hash it
                    "ACTIVE",
                    new Date());
            count++;
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        String msg = "Successfully imported " + count + " users.";
        if (!skipped.isEmpty()) {
            msg += " Skipped " + skipped.size() + " duplicates: " + String.join(", ", skipped);
        }
        res.put("message", msg);
        return res;
    }

    private Map<String, Object> importLessons(List<Map<String, String>> data) {
        String[] required = { "title", "description", "course_id" };
        validateHeaders(data.get(0), required);

        int count = 0;
        for (Map<String, String> row : data) {
            // Inserting into Lesson table as requested
            // Note: course_id is required by the database schema
            jdbcTemplate.update(
                    "INSERT INTO Lesson (title, description, course_id) VALUES (?, ?, ?)",
                    row.get("title"),
                    row.get("description"),
                    row.get("course_id"));
            count++;
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Successfully imported " + count + " lessons.");
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
        if ("students".equalsIgnoreCase(type)) {
            query = "SELECT email, first_name, last_name, role FROM Users WHERE role = 'STUDENT'";
        } else if ("courses".equalsIgnoreCase(type) || "lesson".equalsIgnoreCase(type)) {
            query = "SELECT title, description FROM Lesson";
        } else {
            throw new IllegalArgumentException("Invalid export type.");
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(query);
        StringBuilder sb = new StringBuilder();

        if (rows.isEmpty()) {
            if ("students".equalsIgnoreCase(type)) {
                return "email,first_name,last_name,role\n";
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
