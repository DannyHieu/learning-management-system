package com.example.back_end;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/giaovien")
@CrossOrigin(origins = "http://localhost:5173")
public class GiaoVienController {

    private final JdbcTemplate jdbcTemplate;

    public GiaoVienController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping
    public List<Map<String, Object>> getAllGiaoVien() {
        return jdbcTemplate.queryForList("SELECT * FROM GIAOVIEN");
    }
}
