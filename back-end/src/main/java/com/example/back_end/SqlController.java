package com.example.back_end;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

@RestController

@RequestMapping("/api/sql")
@CrossOrigin(origins = "http://localhost:5173")
public class SqlController {
    Logger logger = LoggerFactory.getLogger(SqlController.class);
    private final JdbcTemplate jdbcTemplate;
    private final ImportService importService;

    public SqlController(JdbcTemplate jdbcTemplate, ImportService importService) {
        this.jdbcTemplate = jdbcTemplate;
        this.importService = importService;
    }

    @PostMapping("/execute")
    public ResponseEntity<?> executeSql(@RequestBody String sql) {
        logger.info("executeSql");
        String trimmed = sql == null ? "" : sql.trim();
        if (trimmed.isEmpty()) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "SQL is empty.");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        }

        String lower = trimmed.toLowerCase();
        try {
            // SELECT/WITH - chắc chắn có result set
            if (lower.startsWith("select") || lower.startsWith("with")) {
                List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
                return ResponseEntity.ok(rows);
            }

            // EXEC/CALL stored procedure - có thể có hoặc không có result set
            if (lower.startsWith("exec") || lower.startsWith("call")) {
                try {
                    List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
                    return ResponseEntity.ok(rows);
                } catch (Exception e) {
                    // Nếu SP không return result set
                    if (e.getMessage() != null &&
                            e.getMessage().contains("did not return a result set")) {

                        // SP đã execute thành công rồi, chỉ cần return success
                        // KHÔNG execute lại để tránh duplicate
                        Map<String, Object> res = new HashMap<>();
                        res.put("success", true);
                        res.put("message", "Stored procedure executed successfully.");
                        return ResponseEntity.ok(res);
                    }
                    // Exception khác (syntax error, permission, etc) thì throw
                    throw e;
                }
            }

            // DDL/DML (UPDATE, DELETE, CREATE, INSERT, etc.)
            jdbcTemplate.execute(sql);
            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            res.put("message", "SQL executed successfully.");
            return ResponseEntity.ok(res);

        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "SQL Error: " + e.getMessage());
            logger.error("SQL execution error", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        }
    }

    @PostMapping("/import")
    public ResponseEntity<?> importData(@RequestParam("file") MultipartFile file, @RequestParam("type") String type) {
        try {
            Map<String, Object> result = importService.importFile(file, type);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "An error occurred during import: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }

    @GetMapping("/export")
    public ResponseEntity<?> exportData(@RequestParam("type") String type) {
        try {
            String csvContent = importService.exportToCSV(type);
            byte[] out = csvContent.getBytes();

            String dateStr = new java.text.SimpleDateFormat("yyyy-MM-dd").format(new java.util.Date());

            return ResponseEntity.ok()
                    .header("Content-Type", "text/csv")
                    .header("Content-Disposition", "attachment; filename=" + type + "_report_" + dateStr + ".csv")
                    .body(out);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "An error occurred during export: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
}
