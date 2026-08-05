import subprocess
import time
import socket

print("Launching PostgreSQL 18 process...")
proc = subprocess.Popen(
    [r"C:\Program Files\PostgreSQL\18\bin\postgres.exe", "-D", r"C:\Program Files\PostgreSQL\18\data"],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL
)

for i in range(10):
    time.sleep(1)
    s = socket.socket()
    res = s.connect_ex(("127.0.0.1", 5433))
    s.close()
    if res == 0:
        print("[OK] PostgreSQL 18 is RUNNING and LISTENING on port 5433!")
        break
