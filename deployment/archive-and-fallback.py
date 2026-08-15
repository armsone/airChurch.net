#!/usr/bin/env python3
import ftplib
import getpass
import json
from pathlib import Path

HOST = "airchurch.net"
USER = "goodshare1"
ROOT = "/www"
FALLBACK = Path(__file__).with_name("cafe24-fallback-index.html")

password = getpass.getpass("FTP password: ")
ftp = ftplib.FTP(HOST, timeout=30)
ftp.login(USER, password)
ftp.cwd(ROOT)
before = set(ftp.nlst())
if "aaa" not in before:
    ftp.mkd("aaa")
archived_before = set(ftp.nlst("aaa"))
for name in ("index.html", "main.png"):
    if name in before and name not in archived_before:
        ftp.rename(name, f"aaa/{name}")
with FALLBACK.open("rb") as source:
    ftp.storbinary("STOR index.html", source)
after = set(ftp.nlst())
archived = set(ftp.nlst("aaa"))
ftp.quit()
print(json.dumps({
    "root": sorted(after),
    "archived": sorted(archived),
    "zangzip_preserved": "zangzip" in after,
    "fallback_installed": "index.html" in after,
}, ensure_ascii=False))
