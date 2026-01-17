# Learning Management System - Frontend

This is the frontend application for the Learning Management System, built with **React**, **TypeScript**, and **Vite**. It connects to a Spring Boot backend and executes SQL queries against a local SQL Server database.

## Prerequisites

Before running this project, ensure you have the following installed:

*   **Node.js**: v18 or higher (using `npm` or `yarn`).
*   **Java JDK**: v17 or higher (for the backend).
*   **SQL Server**: Local instance running on port 1433.

## Project Structure

*   `front-end/`: React application (Vite).
*   `back-end/`: Spring Boot application.

## Setup & Running

To fully run the application, you need to start both the **Backend** (API) and the **Frontend** (UI).

### 1. Start the Backend

The frontend relies on the backend API to fetch data.

1.  Navigate to the `back-end` directory:
    ```bash
    cd ../back-end
    ```
2.  Configure Database Credentials:
    *   Open `src/main/resources/application.properties`.
    *   Update `spring.datasource.username` and `spring.datasource.password` with your local SQL Server credentials.
3.  Run the Spring Boot application:
    ```bash
    ./mvnw spring-boot:run
    ```
    *   The backend will start on `http://localhost:8080`.

### 2. Start the Frontend

1.  Navigate to the `front-end` directory:
    ```bash
    cd ../front-end
    ```
2.  Install dependencies (first time only):
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```
4.  Open your browser to the URL shown (usually `http://localhost:5173`).

## Features

*   **SQL Playground**: Interface to run SQL queries directly against the database.
*   **Dynamic Data Loading**: Automatically fetches and displays data from the `GIAOVIEN` table on startup.
*   **Responsive Design**: distinct layouts for desktop and mobile.

## Troubleshooting

*   **"Failed to fetch" error**: Ensure the backend is running on port 8080.
*   **Database connection error**: Check the credentials in `application.properties` and ensure SQL Server is running and "TCP/IP" is enabled in SQL Server Configuration Manager.
