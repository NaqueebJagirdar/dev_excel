"""
This module defines a SQLAlchemy ORM model for managing spreadsheet data.

The `SheetData` class represents rows in the `sheet_data` table, which stores
information about spreadsheet data, including sheet names, column names, values,
and optional date-related values.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# General database setup
engine = create_engine("sqlite:///database.db")
Session = sessionmaker(bind=engine)
session = Session()


# Declarative base
Base = declarative_base()


class SheetData(Base):
    """
    A SQLAlchemy ORM model representing data stored in a spreadsheet.

    Attributes:
        id (int): The primary key of the record, auto-incremented.
        sheet_name (str): The name of the sheet
        where the data originates. Cannot be null.
        column_name (str): The name of the column in the sheet. Cannot be null.
        value (str, optional): The value stored in the column. Can be null.
        date_value (datetime, optional): A date value
        associated with the record, if any.
        created_at (datetime): The timestamp of when the
        record was created. Defaults to the current UTC time.
    """

    __tablename__ = "sheet_data"
    id = Column(Integer, primary_key=True, autoincrement=True)
    sheet_name = Column(String, nullable=False)  # Store the sheet name
    column_name = Column(String, nullable=False)  # Store column names
    value = Column(Text, nullable=True)  # Store the value
    date_value = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ProjectData(Base):
    __tablename__ = "project_data"
    id = Column(Integer, primary_key=True)
    project_id = Column(String, unique=True, nullable=False)
    data = Column(Text, nullable=True)  # Field to store project-specific data
    is_complex = Column(String, default="no")
    forested = Column(String, default="no")  # New field
    recalculation = Column(String, default="no")  # New field
    cfd = Column(String, default="no")  # New field


# Create tables for all models
Base.metadata.create_all(engine)
