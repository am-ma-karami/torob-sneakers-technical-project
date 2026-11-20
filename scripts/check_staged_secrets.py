"""Review staged blobs without ever printing detected secret values."""

import re
import subprocess

files = (
    subprocess.check_output(["git", "diff", "--cached", "--diff-filter=ACMR", "--name-only", "-z"])
    .decode()
    .split("\0")
)
for name in filter(None, files):
    if name.rsplit("/", 1)[-1] == ".env":
        raise SystemExit("A private environment file is staged; commit refused.")
    content = subprocess.check_output(["git", "show", ":" + name])
    if re.search(rb"21st_sk_[A-Za-z0-9]{20,}", content):
        raise SystemExit("A development credential is staged; commit refused. Values suppressed.")
print("Staged credential scan passed.")
