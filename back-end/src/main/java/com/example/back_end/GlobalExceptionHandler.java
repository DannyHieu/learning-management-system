package com.example.back_end;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.jdbc.BadSqlGrammarException;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleException(Exception e) {
        Map<String, String> errorResponse = new HashMap<>();
        // Simplify the error message for the user
        String message = e.getMessage();
        if (e instanceof BadSqlGrammarException) {
            message = "SQL Error: " + ((BadSqlGrammarException) e).getSQLException().getMessage();
        } else if (e.getCause() instanceof SQLException) {
            message = "SQL Error: " + e.getCause().getMessage();
        }

        errorResponse.put("error", message);
        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }
}
