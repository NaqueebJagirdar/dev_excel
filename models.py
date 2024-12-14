from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class SheetData(Base):
    __tablename__ = 'sheet_data'
    id = Column(Integer, primary_key=True, autoincrement=True)
    sheet_name = Column(String, nullable=False)  # Store the sheet name
    column_name = Column(String, nullable=False)  # Store column names
    value = Column(Text, nullable=True)  # Store the value
    date_value = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Create the database
engine = create_engine('sqlite:///database.db')
Base.metadata.create_all(engine)
