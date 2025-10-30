from app.core.database import sync_engine
from sqlalchemy import inspect

inspector = inspect(sync_engine)
tables = inspector.get_table_names()
print('Tables in database:')
for table in tables:
    print(table)