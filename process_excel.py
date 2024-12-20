"""
Utility module to process Excel files and store their data in a database.

This script reads Excel files, processes the data row by row, and
stores the data in a database using SQLAlchemy ORM models.
"""
import pandas as pd
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from models import SheetData

# Database connection
engine = create_engine("sqlite:///database.db")
Session = sessionmaker(bind=engine)
session = Session()


def process_excel(file_path):
    """
    Process all sheets in the Excel file and dynamically update the database.

    Converts Pandas Timestamp to Python datetime objects for date_value column.

    Args:
        file_path (str): Path to the Excel file.
    """

    # Sheets to include the Blank_Column
    sheets_with_blank_column = ['All_Jobs_Ranked', 'All_Jobs_unRanked', 'Projects_In_Process']

    # Load the Excel file
    xls = pd.ExcelFile(file_path)
    print(f"Processing sheets: {xls.sheet_names}")

    # Clear old data from the database
    session.query(SheetData).delete()
    session.commit()

    # Process each sheet
    for sheet_name in xls.sheet_names:
        df = xls.parse(sheet_name)
        print(f"Original columns in {sheet_name}: {df.columns}")
        # Add a blank column
        if sheet_name in sheets_with_blank_column:
            df["Blank_Column"] = ""  # Add the blank column
            print(f"Updated columns in {sheet_name}: {df.columns}")  # Log updated columns

        # Dynamically process rows and columns
        for _, row in df.iterrows():
            for col in df.columns:
                cell_value = row[col]

                # Decide which column to store in the DB
                date_value = None
                value = None

                # If it's a Pandas Timestamp, convert to Python datetime
                if isinstance(cell_value, pd.Timestamp):
                    date_value = cell_value.to_pydatetime()  # pure Python datetime
                else:
                    # Store non-dates (and also Timestamps
                    # that are not recognized) as text
                    if not pd.isna(cell_value):
                        value = str(cell_value)  # convert to string

                sheet_data = SheetData(
                    sheet_name=sheet_name,
                    column_name=col,
                    value=value,
                    date_value=date_value,
                )
                session.add(sheet_data)

    # Commit the changes
    session.commit()
    print("Database updated with the latest Excel data.")
