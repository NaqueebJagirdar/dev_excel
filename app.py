"""
Flask application for dynamic Excel tracking and database integration.

This application provides a web interface to view, filter, and interact with
Excel data stored in a database. The application automatically processes Excel
files uploaded to a specified directory and stores the data in the database.
It supports REST APIs for retrieving sheet data, filtering based on columns,
and rendering a web-based tracker interface.
"""

from flask import Flask, jsonify, render_template, request
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine, and_
from process_excel import process_excel
from models import SheetData
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os

app = Flask(__name__, static_folder="static")


@app.route("/")
def homepage():
    """Serve the homepage with options for Admin and User."""
    return render_template("homepage.html")


@app.route("/admin")
def admin():
    """Redirect to the job tracker page for Admin."""
    return render_template("index.html")  # Existing job tracker


@app.route("/user")
def user():
    """Redirect to a placeholder page for the User."""
    return render_template("user.html")  # Blank page for now


# Database setup
engine = create_engine("sqlite:///database.db")
Session = sessionmaker(bind=engine)
session = Session()

# Path to the Excel file
EXCEL_FILE_PATH = r"C:\Users\00090874\Downloads\All_Regions_OpenProjects.xlsx"
os.makedirs("./uploads", exist_ok=True)


# Watchdog event handler for file monitoring
class FileEventHandler(FileSystemEventHandler):
    """
    Handles file system events to process new Excel files.

    Watches a specified directory for new or modified Excel files and processes
    them by storing their data in the database.
    """

    def __init__(self, file_path):
        """
        Initialize the FileEventHandler.

        Args:
            file_path (str): The path of the file to monitor for changes.
        """
        self.file_path = file_path

    def on_modified(self, event):
        """
        Handle the file modification event.

        Checks if the modified file matches the monitored file path and triggers
        the Excel processing function.

        Args:
            event (FileSystemEvent): The event object containing information about
            the file system event.
        """
        if event.src_path.endswith(self.file_path):
            print(f"{self.file_path} modified. Reprocessing...")
            process_excel(self.file_path)


# Start file monitoring
def start_file_monitoring(file_path):
    """
    Start monitoring a specific file for changes.

    This function initializes a file system observer to monitor a given file for modifications.
    When the file is modified, the associated event handler processes the changes.

    Args:
        file_path (str): The path of the file to monitor for changes.
    """
    event_handler = FileEventHandler(file_path)
    observer = Observer()
    observer.schedule(event_handler, path=os.path.dirname(file_path), recursive=False)
    observer.start()
    while observer.is_alive():  # Keep the observer running
        observer.join(1)


@app.route("/")
def index():
    """Serve the main page."""
    return render_template("index.html")


@app.route("/sheets", methods=["GET"])
def get_sheet_names():
    """Get the list of unique sheet names."""
    sheets = session.query(SheetData.sheet_name).distinct().all()
    sheet_names = [sheet[0] for sheet in sheets]
    print("Sheets: ", sheet_names)
    return jsonify(sheet_names)


@app.route("/filters/<sheet_name>", methods=["GET"])
def get_column_filters(sheet_name):
    """Fetch unique filter values for each column in a given sheet."""
    try:
        columns = (
            session.query(SheetData.column_name)
            .filter(SheetData.sheet_name == sheet_name)
            .distinct()
            .all()
        )
        filters = {}
        for column_name in [col[0] for col in columns]:
            unique_values = (
                session.query(SheetData.value)
                .filter(
                    SheetData.sheet_name == sheet_name,
                    SheetData.column_name == column_name,
                )
                .distinct()
                .all()
            )
            filters[column_name] = [
                value[0] for value in unique_values if value[0] is not None
            ]

        # Log the filters for debugging purposes
        print(f"Filters for sheet '{sheet_name}': {filters}")
        return jsonify(filters)

    except Exception as e:
        # Log any errors for debugging
        print(f"Error fetching filters for sheet '{sheet_name}': {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/data/<sheet_name>", methods=["GET"])
def get_sheet_data(sheet_name):
    """Fetch filtered data for a given sheet."""
    # Get filter parameters from the request
    filters = request.args.to_dict()

    query = session.query(SheetData).filter(SheetData.sheet_name == sheet_name)
    for column, value in filters.items():
        query = query.filter(
            and_(SheetData.column_name == column, SheetData.value == value)
        )

    data = query.all()
    result = {}
    for row in data:
        if row.column_name not in result:
            result[row.column_name] = []
        result[row.column_name].append(row.value)

    # Ensure Blank_Column is included
    if result:
        if "Blank_Column" not in result:
            result["Blank_Column"] = [""] * len(result[next(iter(result))])  # Add blanks dynamically

    # Debug log
    print(f"Data for sheet '{sheet_name}': {result}")

    return jsonify(result)


    data = query.all()
    result = {}
    for row in data:
        if row.column_name not in result:
            result[row.column_name] = []
        result[row.column_name].append(row.value)

        # Ensure Blank_Column is included
    if "Blank_Column" not in result:
        result["Blank_Column"] = [""] * len(result[next(iter(result))])  # Add blanks

    return jsonify(result)

@app.route('/update-blank-column', methods=['POST'])
def update_blank_column():
    data = request.json
    sheet_name = data.get('sheetName')
    row_index = int(data.get('rowIndex'))
    new_value = data.get('newValue')

    print(f"Received update for sheet: {sheet_name}, row: {row_index}, value: {new_value}")  # Debug log

    try:
        row_to_update = (
            session.query(SheetData)
            .filter(SheetData.sheet_name == sheet_name)
            .filter(SheetData.column_name == "Blank_Column")
            .offset(row_index)
            .limit(1)
            .first()
        )

        if row_to_update:
            print(f"Updating row ID: {row_to_update.id}")  # Debug log
            row_to_update.value = new_value
            session.commit()
            return jsonify({"status": "success"})
        else:
            print("Row not found")  # Debug log
            return jsonify({"status": "error", "message": "Row not found"}), 404
    except Exception as e:
        print(f"Error: {e}")  # Debug log
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    process_excel(EXCEL_FILE_PATH)
    app.run(debug=True, use_reloader=False)
    rows = session.query(SheetData).all()
    print("Row count in DB after process_excel:", len(rows))
