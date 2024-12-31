"""
Flask application for dynamic Excel tracking and database integration.

This application provides a web interface to view, filter, and interact with
Excel data stored in a database. The application automatically processes Excel
files uploaded to a specified directory and stores the data in the database.
It supports REST APIs for retrieving sheet data, filtering based on columns,
and rendering a web-based tracker interface.
"""

import os
from datetime import datetime

from flask import Flask, jsonify, redirect, render_template, request
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import and_, create_engine
from sqlalchemy.orm import sessionmaker
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from models import ProjectData, SheetAnalysis, SheetData
from process_excel import process_excel

app = Flask(__name__)
app.config[
    "SQLALCHEMY_DATABASE_URI"
] = "sqlite:///database.db"  # Replace with your DB URI
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)
migrate = Migrate(app, db)


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


from flask import render_template


@app.route("/statistics", methods=["GET"])
def statistics():
    """
    Render the statistics page with unassigned WSE counts for each sheet.
    """
    stats = session.query(SheetAnalysis).all()
    return render_template("statistics.html", stats=stats)


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

        Checks if the modified file
        matches the monitored file path and triggers
        the Excel processing function.

        Args:
            event (FileSystemEvent): The event
            object containing information about
            the file system event.
        """
        if event.src_path.endswith(self.file_path):
            print(f"{self.file_path} modified. Reprocessing...")
            process_excel(self.file_path)


# Start file monitoring
def start_file_monitoring(file_path):
    """
    Start monitoring a specific file for changes.

    This function initializes a file system
    observer to monitor a given file for modifications.
    When the file is modified, the associated
    event handler processes the changes.

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
    filters = request.args.to_dict()

    # Query filtered data based on sheet name and applied filters
    query = session.query(SheetData).filter(SheetData.sheet_name == sheet_name)
    for column, value in filters.items():
        query = query.filter(
            and_(SheetData.column_name == column, SheetData.value == value)
        )

    data = query.all()
    result = {}

    # Process data into the result dictionary
    for row in data:
        if row.column_name not in result:
            result[row.column_name] = []
        result[row.column_name].append(row.value)

    # Debug: Log all columns in result
    print("Columns in result before filtering:", list(result.keys()))

    # Add the "checker" field if it exists in the database
    project_ids = result.get("ID", [])
    if project_ids:
        # Fetch all project data in one query
        projects = (
            session.query(ProjectData)
            .filter(ProjectData.project_id.in_(project_ids))
            .all()
        )
        project_checkers = {p.project_id: p.checker for p in projects}

        # Populate the checker field
        result["checker"] = [
            project_checkers.get(pid, "Not Assigned") for pid in project_ids
        ]

    # Log the final result for debugging
    print(f"Final data for sheet '{sheet_name}':", result)

    return jsonify(result)


@app.route("/project/<project_id>", methods=["GET", "POST"])
def project_page(project_id):
    if request.method == "GET":
        project = session.query(ProjectData).filter_by(project_id=project_id).first()
        if project:
            return render_template(
                "project.html",
                project_id=project_id,
                data=project.data,
                is_complex=project.is_complex,
                forested=project.forested,
                recalculation=project.recalculation,
                cfd=project.cfd,
            )
        else:
            return render_template(
                "project.html",
                project_id=project_id,
                data=None,
                is_complex="no",
                forested="no",
                recalculation="no",
                cfd="no",
            )
    elif request.method == "POST":
        data = request.form.get("data")
        is_complex = request.form.get("complex")
        forested = request.form.get("forested")
        recalculation = request.form.get("recalculation")
        cfd = request.form.get("cfd")

        project = session.query(ProjectData).filter_by(project_id=project_id).first()
        if project:
            project.data = data
            project.is_complex = is_complex
            project.forested = forested
            project.recalculation = recalculation
            project.cfd = cfd
        else:
            new_project = ProjectData(
                project_id=project_id,
                data=data,
                is_complex=is_complex,
                forested=forested,
                recalculation=recalculation,
                cfd=cfd,
            )
            session.add(new_project)
        session.commit()

        return render_template(
            "project.html",
            project_id=project_id,
            data=data,
            is_complex=is_complex,
            forested=forested,
            recalculation=recalculation,
            cfd=cfd,
        )


@app.route("/update_checker/<project_id>", methods=["POST"])
def update_checker(project_id):
    """Update the checker field for a project and dynamically handle empty or new checker entries."""
    # Parse the JSON payload
    data = request.json
    checker = data.get("checker", "")  # Default to an empty string if not provided

    # Log the incoming request
    print(f"Incoming request: project_id={project_id}, checker={checker or '(none)'}")

    # Allow blank values to clear the checker
    if checker is None or checker.strip() == "":
        checker = None  # Set to None or handle as needed

    # Check if the project exists in the database
    project = session.query(ProjectData).filter_by(project_id=project_id).first()

    if not project:
        # Log and create a new project entry if it doesn't exist
        print(f"Project with ID {project_id} not found. Creating a new entry.")
        project = ProjectData(
            project_id=project_id,
            data=None,
            is_complex="no",
            forested="no",
            recalculation="no",
            cfd="no",
            checker=None,  # Default to None when creating a new project
        )
        session.add(project)
        session.commit()

    # Update the checker field
    print(f"Updating checker for project ID {project_id} to '{checker or '(none)'}'")
    project.checker = checker
    session.commit()

    # Log the successful update
    print(
        f"Successfully updated checker for project ID {project_id} to '{project.checker or '(none)'}'"
    )

    return jsonify({"message": "Checker updated successfully"}), 200


@app.route("/checker_list", methods=["GET"])
def get_checker_list():
    """Return a list of all valid checker names, including newly added ones."""
    valid_checkers = session.query(ProjectData.checker).distinct().all()
    checker_names = [checker[0] for checker in valid_checkers if checker[0]]
    return jsonify(checker_names)


@app.route("/update_statistics")
def update_statistics():
    # Call your function to calculate statistics
    calculate_unassigned_wse()
    return redirect("/statistics")


from datetime import datetime


def calculate_unassigned_wse():
    sheets = [
        "ALL_JOBS_RANKED",
        "ALL_JOBS_UNRANKED",
        "PROJECTS_IN_PROCESS",
        "PROJECTS_PROCESSED",
    ]

    for sheet in sheets:
        normalized_sheet = sheet.upper()  # Normalize sheet name to uppercase
        print(f"Processing sheet: {normalized_sheet}")

        # Query total unassigned WSE Responsible entries
        unassigned_count = (
            session.query(SheetData)
            .filter(
                SheetData.sheet_name.ilike(
                    normalized_sheet
                ),  # Case-insensitive comparison
                SheetData.column_name == "WSE Responsible",
                SheetData.value == "#",
            )
            .count()
        )

        # Debugging: Log the count of unassigned entries
        print(f"Unassigned count for {normalized_sheet}: {unassigned_count}")

        # Update or insert statistics in the database
        stat = (
            session.query(SheetAnalysis)
            .filter(SheetAnalysis.sheet_name == normalized_sheet)
            .first()
        )
        if stat:
            stat.unassigned_count = unassigned_count
            stat.created_at = datetime.utcnow()
        else:
            new_stat = SheetAnalysis(
                sheet_name=normalized_sheet,  # Ensure consistent casing
                unassigned_count=unassigned_count,
                created_at=datetime.utcnow(),
            )
            session.add(new_stat)

    # Commit changes to the database
    session.commit()
    print("Statistics updated successfully.")


if __name__ == "__main__":
    process_excel(EXCEL_FILE_PATH)
    app.run(debug=True, use_reloader=False)
    rows = session.query(SheetData).all()
    print("Row count in DB after process_excel:", len(rows))
