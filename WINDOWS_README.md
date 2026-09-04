# How to Run on Windows

This application is compatible with Windows. Follow these steps to get started.

## Prerequisites

1.  **Node.js**: Install Node.js (version 20 or higher recommended) from [nodejs.org](https://nodejs.org/).
2.  **Git**: Install Git for Windows from [git-scm.com](https://git-scm.com/).

## Installation

1.  Open **Command Prompt**, **PowerShell**, or **Git Bash**.
2.  Clone the repository (if you haven't already):
    ```bash
    git clone <repository-url>
    cd <repository-folder>
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```

## Running the Application

### Development Mode
To run the application in development mode (with hot reloading):
```bash
npm run dev
```
The application will start, and you can access it at `http://localhost:5000`.

### Production Build
To build and start the production version:
```bash
npm run build
npm start
```

## Running the Brainstorm Studio (Python)

If you want to run the Python-based Brainstorm Studio:

1.  **Install Python**: Install Python 3.8+ from [python.org](https://www.python.org/) or the Microsoft Store. Ensure you check "Add Python to PATH" during installation.
2.  Navigate to the directory:
    ```bash
    cd brainstorm_studio
    ```
3.  Create a virtual environment (optional but recommended):
    ```bash
    python -m venv venv
    .\venv\Scripts\activate
    ```
4.  Install dependencies:
    ```bash
    pip install flask google-genai python-dotenv
    ```
5.  Set your API Key:
    -   Create a `.env` file in `brainstorm_studio` folder.
    -   Add: `GEMINI_API_KEY=your_api_key_here`
6.  Run the app:
    ```bash
    python app.py
    ```

## Troubleshooting

-   **'npm' is not recognized**: Ensure Node.js is installed and added to your PATH environment variable.
-   **Execution Policy Error (PowerShell)**: If you can't run scripts, you might need to run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` in PowerShell.
