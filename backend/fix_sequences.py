#!/usr/bin/env python3

import psycopg2

conn = psycopg2.connect(host='localhost', database='attendancedb', user='postgres', password='nadin123')
cur = conn.cursor()

# Fix sequences
cur.execute('SELECT setval(\'subjects_id_seq\', (SELECT COALESCE(MAX(id), 0) + 1 FROM subjects))')
cur.execute('SELECT setval(\'class_schedules_id_seq\', (SELECT COALESCE(MAX(id), 0) + 1 FROM class_schedules))')

conn.commit()
print('✅ Sequences fixed')
conn.close()