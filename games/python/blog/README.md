# Flask Blog

A small server-rendered blog using Flask and SQLite. Anyone can read posts; users can register, log in, publish posts, and edit or delete their own posts.

## Requirements

- Python 3.10+
- Flask (installed from `requirements.txt`)

## Setup and run

From this directory:

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt
export BLOG_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
python main.py
```

Open <http://127.0.0.1:5000>. On Windows PowerShell, set the secret with:

```powershell
$env:BLOG_SECRET_KEY = python -c "import secrets; print(secrets.token_hex(32))"
```

The database is created automatically at `instance/blog.sqlite3`. Set `BLOG_DATABASE` to use another SQLite file. Set `FLASK_DEBUG=1` only for local development.

Keep `BLOG_SECRET_KEY` private and stable between restarts so existing sessions remain valid. For production, use HTTPS, set `BLOG_COOKIE_SECURE=1`, and supply a strong secret through the deployment environment; do not enable Flask debug mode.

## Use

Register with a 3–32 character username (letters, numbers, `.`, `_`, and `-`) and a password of at least eight characters. Posts require a title and body. Posts are publicly readable; only the author can edit or delete them.

## Tests

Run the regression suite from this directory:

```bash
python -m unittest discover -s tests -v
```

Tests use Flask's test client and a temporary SQLite database; they do not modify the development database.
