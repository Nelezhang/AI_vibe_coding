import re
import tempfile
import unittest
from pathlib import Path

from main import create_app


class BlogTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        database = Path(self.temp_dir.name) / "blog.sqlite3"
        self.app = create_app(
            {
                "TESTING": True,
                "DATABASE": str(database),
                "SECRET_KEY": "test-secret",
            }
        )
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def csrf_token(self):
        with self.client.session_transaction() as session:
            token = session.get("csrf_token")
        if token is None:
            self.client.get("/login")
            with self.client.session_transaction() as session:
                token = session["csrf_token"]
        return token

    def post(self, path, data=None, **kwargs):
        form_data = dict(data or {})
        form_data["csrf_token"] = self.csrf_token()
        return self.client.post(path, data=form_data, **kwargs)

    def register(self, username="alice", password="correct-horse"):
        return self.post(
            "/register",
            {
                "username": username,
                "password": password,
                "password_confirmation": password,
            },
            follow_redirects=True,
        )

    def logout(self):
        return self.post("/logout", follow_redirects=True)

    def test_registration_login_and_logout(self):
        response = self.register()
        self.assertIn(b"Your account is ready.", response.data)
        with self.client.session_transaction() as session:
            self.assertIn("user_id", session)

        self.logout()
        with self.client.session_transaction() as session:
            self.assertNotIn("user_id", session)

        response = self.post(
            "/login",
            {"username": "ALICE", "password": "correct-horse"},
            follow_redirects=True,
        )
        self.assertIn(b"You are now logged in.", response.data)
        with self.client.session_transaction() as session:
            self.assertIn("user_id", session)

    def test_registration_validation_duplicate_and_password_hash(self):
        response = self.post(
            "/register",
            {
                "username": "alice",
                "password": "correct-horse",
                "password_confirmation": "different",
            },
        )
        self.assertIn(b"Passwords do not match.", response.data)
        with self.client.session_transaction() as session:
            self.assertNotIn("user_id", session)

        response = self.post(
            "/register",
            {
                "username": "x",
                "password": "correct-horse",
                "password_confirmation": "correct-horse",
            },
        )
        self.assertIn(b"Username must be", response.data)

        self.register()
        duplicate = self.register(username="ALICE")
        self.assertIn(b"already registered", duplicate.data)
        with self.app.app_context():
            from main import get_db

            user = get_db().execute(
                "SELECT password_hash FROM users WHERE username = 'alice'"
            ).fetchone()
            self.assertNotEqual(user["password_hash"], "correct-horse")
            self.assertTrue(user["password_hash"].startswith("scrypt:"))

    def test_invalid_login_does_not_authenticate_and_next_url_is_safe(self):
        self.register()
        self.logout()
        response = self.post(
            "/login",
            {"username": "alice", "password": "wrong"},
            follow_redirects=True,
        )
        self.assertIn(b"Invalid username or password.", response.data)
        with self.client.session_transaction() as session:
            self.assertNotIn("user_id", session)

        response = self.client.get("/login?next=https://example.com")
        token = self.csrf_token()
        response = self.client.post(
            "/login?next=https://example.com",
            data={
                "csrf_token": token,
                "username": "alice",
                "password": "correct-horse",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "/")

    def test_logged_out_users_cannot_create_posts_and_posts_are_public(self):
        response = self.client.get("/posts/new")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/login?next=", response.headers["Location"])
        self.assertEqual(
            self.post("/posts/new", {"title": "Blocked", "body": "No access"}).status_code,
            302,
        )
        self.register()
        created = self.post(
            "/posts/new", {"title": "First post", "body": "A little story"}
        )
        self.assertEqual(created.status_code, 302)
        self.logout()
        response = self.client.get("/")
        self.assertIn(b"First post", response.data)
        self.assertIn(b"A little story", response.data)

    def test_post_validation_and_csrf_protection(self):
        self.register()
        response = self.post("/posts/new", {"title": " ", "body": "Text"})
        self.assertIn(b"A title is required.", response.data)
        response = self.client.post(
            "/posts/new", data={"title": "No token", "body": "Rejected"}
        )
        self.assertEqual(response.status_code, 400)
        self.assertNotIn(b"No token", self.client.get("/").data)

    def test_owner_can_edit_and_delete_but_other_user_cannot(self):
        self.register("alice")
        created = self.post(
            "/posts/new", {"title": "Original", "body": "Original body"}
        )
        post_id = int(re.search(r"/posts/(\d+)$", created.headers["Location"]).group(1))

        self.logout()
        self.register("bob")
        self.assertEqual(self.client.get(f"/posts/{post_id}/edit").status_code, 403)
        forbidden_edit = self.post(
            f"/posts/{post_id}/edit", {"title": "Changed", "body": "Changed body"}
        )
        self.assertEqual(forbidden_edit.status_code, 403)
        self.assertEqual(self.post(f"/posts/{post_id}/delete").status_code, 403)

        self.logout()
        self.post("/login", {"username": "alice", "password": "correct-horse"})
        updated = self.post(
            f"/posts/{post_id}/edit", {"title": "Updated", "body": "Updated body"}
        )
        self.assertEqual(updated.status_code, 302)
        detail = self.client.get(f"/posts/{post_id}")
        self.assertIn(b"Updated", detail.data)
        self.assertIn(b"Updated body", detail.data)
        deleted = self.post(f"/posts/{post_id}/delete")
        self.assertEqual(deleted.status_code, 302)
        self.assertEqual(self.client.get(f"/posts/{post_id}").status_code, 404)

    def test_unknown_post_returns_not_found_and_content_is_escaped(self):
        self.register()
        response = self.post(
            "/posts/new",
            {"title": "<script>alert(1)</script>", "body": "<b>plain text</b>"},
        )
        post_id = int(re.search(r"/posts/(\d+)$", response.headers["Location"]).group(1))
        detail = self.client.get(f"/posts/{post_id}")
        self.assertIn(b"&lt;script&gt;", detail.data)
        self.assertIn(b"&lt;b&gt;plain text&lt;/b&gt;", detail.data)
        self.assertEqual(self.client.get("/posts/999").status_code, 404)

    def test_database_survives_application_recreation(self):
        self.register()
        self.post("/posts/new", {"title": "Persistent", "body": "Saved in sqlite"})
        database = self.app.config["DATABASE"]
        second_app = create_app(
            {
                "TESTING": True,
                "DATABASE": database,
                "SECRET_KEY": "test-secret",
            }
        )
        response = second_app.test_client().get("/")
        self.assertIn(b"Persistent", response.data)


if __name__ == "__main__":
    unittest.main()
