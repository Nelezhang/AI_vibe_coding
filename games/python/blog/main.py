"""A small Flask blog backed by SQLite."""

from __future__ import annotations

import hmac
import os
import re
import secrets
import sqlite3
from functools import wraps
from pathlib import Path
from typing import Any, Callable, TypeVar
from urllib.parse import urlsplit

from flask import (
    Flask,
    abort,
    flash,
    g,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")
MAX_TITLE_LENGTH = 200
MAX_BODY_LENGTH = 20_000
F = TypeVar("F", bound=Callable[..., Any])


def create_app(test_config: dict[str, Any] | None = None) -> Flask:
    """Create and configure the Flask application."""
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        DATABASE=os.environ.get(
            "BLOG_DATABASE", str(Path(app.instance_path) / "blog.sqlite3")
        ),
        SECRET_KEY=os.environ.get("BLOG_SECRET_KEY"),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SECURE=os.environ.get("BLOG_COOKIE_SECURE") == "1",
        SESSION_COOKIE_SAMESITE="Lax",
    )
    if test_config is not None:
        app.config.update(test_config)
    if app.config["SECRET_KEY"] is None:
        if app.config["TESTING"]:
            app.config["SECRET_KEY"] = "test-only-secret-key"
        else:
            raise RuntimeError(
                "Set BLOG_SECRET_KEY to a long, random value before starting the blog."
            )

    Path(app.config["DATABASE"]).parent.mkdir(parents=True, exist_ok=True)
    init_db(app)

    @app.before_request
    def load_user() -> None:
        user_id = session.get("user_id")
        g.user = None
        if user_id is not None:
            g.user = get_db().execute(
                "SELECT id, username FROM users WHERE id = ?", (user_id,)
            ).fetchone()
            if g.user is None:
                session.clear()

    @app.before_request
    def protect_forms() -> None:
        if request.method != "POST":
            return
        expected = session.get("csrf_token", "")
        submitted = request.form.get("csrf_token", "")
        if not expected or not hmac.compare_digest(expected, submitted):
            abort(400, description="The form expired or was invalid. Please try again.")

    @app.context_processor
    def inject_csrf_token() -> dict[str, Callable[[], str]]:
        def csrf_token() -> str:
            if "csrf_token" not in session:
                session["csrf_token"] = secrets.token_urlsafe(32)
            return session["csrf_token"]

        return {"csrf_token": csrf_token}

    @app.teardown_appcontext
    def close_db(_error: BaseException | None = None) -> None:
        connection = g.pop("db", None)
        if connection is not None:
            connection.close()

    @app.get("/")
    def index():
        posts = get_db().execute(
            """
            SELECT posts.id, posts.title, posts.body, posts.created_at,
                   users.username
            FROM posts JOIN users ON users.id = posts.author_id
            ORDER BY posts.created_at DESC, posts.id DESC
            """
        ).fetchall()
        return render_template("index.html", posts=posts)

    @app.get("/posts/<int:post_id>")
    def post_detail(post_id: int):
        post = get_post(post_id)
        return render_template("post_detail.html", post=post)

    @app.route("/register", methods=["GET", "POST"])
    def register():
        if request.method == "POST":
            username = request.form.get("username", "").strip()
            password = request.form.get("password", "")
            confirmation = request.form.get("password_confirmation", "")
            error = validate_registration(username, password, confirmation)
            if error is None:
                try:
                    cursor = get_db().execute(
                        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                        (username, generate_password_hash(password)),
                    )
                    get_db().commit()
                except sqlite3.IntegrityError:
                    error = "That username is already registered."
                else:
                    session.clear()
                    session["user_id"] = cursor.lastrowid
                    flash("Your account is ready.")
                    return redirect(url_for("index"))
            if error:
                flash(error, "error")
        return render_template("register.html")

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if request.method == "POST":
            username = request.form.get("username", "").strip()
            password = request.form.get("password", "")
            user = get_db().execute(
                "SELECT id, username, password_hash FROM users "
                "WHERE username = ? COLLATE NOCASE",
                (username,),
            ).fetchone()
            if user is None or not check_password_hash(user["password_hash"], password):
                flash("Invalid username or password.", "error")
            else:
                session.clear()
                session["user_id"] = user["id"]
                flash("You are now logged in.")
                destination = request.args.get("next", "")
                if is_safe_next_url(destination):
                    return redirect(destination)
                return redirect(url_for("index"))
        return render_template("login.html")

    @app.post("/logout")
    @login_required
    def logout():
        session.clear()
        flash("You have been logged out.")
        return redirect(url_for("index"))

    @app.route("/posts/new", methods=["GET", "POST"])
    @login_required
    def create_post():
        if request.method == "POST":
            title, body, error = validate_post(
                request.form.get("title", ""), request.form.get("body", "")
            )
            if error is None:
                cursor = get_db().execute(
                    "INSERT INTO posts (author_id, title, body) VALUES (?, ?, ?)",
                    (g.user["id"], title, body),
                )
                get_db().commit()
                flash("Your post was published.")
                return redirect(url_for("post_detail", post_id=cursor.lastrowid))
            flash(error, "error")
            return render_template(
                "post_form.html",
                heading="New post",
                title=request.form.get("title", ""),
                body=request.form.get("body", ""),
            )
        return render_template("post_form.html", heading="New post", title="", body="")

    @app.route("/posts/<int:post_id>/edit", methods=["GET", "POST"])
    @login_required
    def edit_post(post_id: int):
        post = get_post(post_id)
        require_owner(post)
        if request.method == "POST":
            title, body, error = validate_post(
                request.form.get("title", ""), request.form.get("body", "")
            )
            if error is None:
                get_db().execute(
                    """
                    UPDATE posts SET title = ?, body = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (title, body, post_id),
                )
                get_db().commit()
                flash("Your post was updated.")
                return redirect(url_for("post_detail", post_id=post_id))
            flash(error, "error")
            return render_template(
                "post_form.html",
                heading="Edit post",
                title=request.form.get("title", ""),
                body=request.form.get("body", ""),
            )
        return render_template(
            "post_form.html",
            heading="Edit post",
            title=post["title"],
            body=post["body"],
        )

    @app.post("/posts/<int:post_id>/delete")
    @login_required
    def delete_post(post_id: int):
        post = get_post(post_id)
        require_owner(post)
        get_db().execute("DELETE FROM posts WHERE id = ?", (post_id,))
        get_db().commit()
        flash("Your post was deleted.")
        return redirect(url_for("index"))

    return app


def login_required(view: F) -> F:
    @wraps(view)
    def wrapped_view(*args: Any, **kwargs: Any):
        if g.user is None:
            return redirect(url_for("login", next=request.url))
        return view(*args, **kwargs)

    return wrapped_view  # type: ignore[return-value]


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        connection = sqlite3.connect(current_database_path())
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        g.db = connection
    return g.db


def current_database_path() -> str:
    from flask import current_app

    return current_app.config["DATABASE"]


def init_db(app: Flask) -> None:
    """Create the database schema if it does not exist."""
    with app.app_context():
        connection = sqlite3.connect(app.config["DATABASE"])
        try:
            connection.execute("PRAGMA foreign_keys = ON")
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS posts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    author_id INTEGER NOT NULL REFERENCES users (id)
                        ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    body TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS posts_created_at_idx
                    ON posts (created_at DESC, id DESC);
                CREATE INDEX IF NOT EXISTS posts_author_id_idx
                    ON posts (author_id);
                """
            )
            connection.commit()
        finally:
            connection.close()


def get_post(post_id: int) -> sqlite3.Row:
    post = get_db().execute(
        """
        SELECT posts.id, posts.author_id, posts.title, posts.body,
               posts.created_at, posts.updated_at, users.username
        FROM posts JOIN users ON users.id = posts.author_id
        WHERE posts.id = ?
        """,
        (post_id,),
    ).fetchone()
    if post is None:
        abort(404)
    return post


def require_owner(post: sqlite3.Row) -> None:
    if post["author_id"] != g.user["id"]:
        abort(403)


def validate_registration(username: str, password: str, confirmation: str) -> str | None:
    if not USERNAME_PATTERN.fullmatch(username):
        return "Username must be 3–32 characters using letters, numbers, dots, dashes, or underscores."
    if len(password) < 8:
        return "Password must be at least 8 characters."
    if password != confirmation:
        return "Passwords do not match."
    return None


def validate_post(title_value: str, body_value: str) -> tuple[str, str, str | None]:
    title = title_value.strip()
    body = body_value.strip()
    if not title:
        return title, body, "A title is required."
    if len(title) > MAX_TITLE_LENGTH:
        return title, body, f"Title must be {MAX_TITLE_LENGTH} characters or fewer."
    if not body:
        return title, body, "Post content is required."
    if len(body) > MAX_BODY_LENGTH:
        return title, body, f"Post content must be {MAX_BODY_LENGTH} characters or fewer."
    return title, body, None


def is_safe_next_url(destination: str) -> bool:
    if not destination or "\\" in destination or any(ord(char) < 32 for char in destination):
        return False
    parsed = urlsplit(destination)
    return (
        not parsed.scheme
        and not parsed.netloc
        and destination.startswith("/")
        and not destination.startswith("//")
        and parsed.path.startswith("/")
        and not parsed.path.startswith("//")
    )


if __name__ == "__main__":
    create_app().run(debug=os.environ.get("FLASK_DEBUG") == "1")
