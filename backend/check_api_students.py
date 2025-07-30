import requests

token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Iiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzUyMzg2MTQ2fQ.HZDykJKXQIFHamklpQWxMkLXcpoRJc_221tFZZCPBD4'
resp = requests.get('http://localhost:8000/api/students', headers={'Authorization': f'Bearer {token}'})
students = resp.json()

print('Updated student data:')
for s in students:
    print(f'{s["name"]}: {s["faculty"]}')
