# Blog System Architecture

## Overview

The application is a small server-rendered Flask site backed by SQLite. Flask routes coordinate request validation, session-based authentication, database operations, and Jinja templates. The database is the source of truth for users and posts.

```text
Browser
  | HTTP requests / HTML responses
Flask application
  | route handlers, authentication checks, validation
  +-- Jinja templates
  +-- SQLite data access
        +-- users
        +-- posts
```

## Proposed project layout

```text
games/python/blog/
  README.md
  main.py
  requirements.txt
  spec.md
  proposal.md
  architecture.md
  design.md
  templates/
    base.html
    index.html
    post_detail.html
    register.html
    login.html
    post_form.html
  static/
    style.css
  tests/
    test_blog.py
```

The implementation may keep a small application in one Python module initially. Database and authentication helpers should be separated into clear functions so they can be tested independently without introducing unnecessary framework structure.

## Request and authentication flow

1. A request reaches a Flask route.
2. Public routes render content or forms without requiring a session.
3. Protected routes verify that the session contains a valid logged-in user ID; otherwise, the request redirects to login.
4. On successful registration, the application hashes the password and inserts a user record.
5. On successful login, the application verifies the password hash and stores the user's ID in the signed session.
6. On logout, the session is cleared.
7. Post mutations validate the submitted fields and associate the post with the authenticated user's ID.
8. Edit/delete operations check ownership before changing a post.

## Data model

### `users`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | Primary key |
| `username` | TEXT | Required, unique |
| `password_hash` | TEXT | Required |
| `created_at` | TEXT | Required |

### `posts`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | Primary key |
| `author_id` | INTEGER | Required foreign key to `users.id` |
| `title` | TEXT | Required |
| `body` | TEXT | Required |
| `created_at` | TEXT | Required |
| `updated_at` | TEXT | Required |

Enable SQLite foreign-key enforcement for each connection. Index post creation time and author ID if needed for the recent-post list and user-owned post queries.

## Configuration and persistence

- Use an environment variable for Flask's secret key; fail with a clear configuration error when it is absent outside an explicitly configured test environment.
- Allow the SQLite database path to be configured so tests can use a temporary file and local development can use a persistent project data file.
- Initialize the schema through an explicit database initialization helper that is safe to invoke more than once.
- Do not commit generated databases, production secrets, or real user data.

## Security boundaries

- Store only Werkzeug-generated password hashes and verify via the matching Werkzeug helper.
- Use parameterized SQL for all data values.
- Apply authentication checks to all post mutation routes and ownership checks to post-specific edits/deletes.
- Keep state-changing actions on POST requests; include CSRF protection for browser forms.
- Rely on Jinja autoescaping; do not mark user-supplied post content as safe HTML.
- Set secure cookie options for production deployment; local development may need different settings for HTTP.

## Test seams

- A configurable database path isolates each test's data.
- Flask's test client can exercise routes and session behavior without a live server.
- Cover registration/login/logout, logged-out denial, post persistence, validation failures, and ownership restrictions.
