# Blog System Proposal

## Goal

Build a small web blog with Python Flask and SQLite. Visitors can read published posts, and registered, logged-in users can create posts. The application should be straightforward to run locally and include regression tests.

## Proposed user experience

- Visitors can browse a home page containing recent posts and open an individual post.
- Visitors can register with a username and password, then log in and log out.
- Logged-in users can create posts and manage their own posts.
- A user cannot create, edit, or delete posts while logged out.
- Unauthenticated users who try to access a protected action are redirected to log in.

Post ownership and edit/delete behavior are proposed defaults; please confirm whether users should be able to edit or delete only their own posts, and whether posts should be publicly readable.

## Proposed implementation

- Flask handles pages, forms, sessions, and routing.
- SQLite stores user accounts and blog posts.
- Passwords are stored as salted password hashes using Werkzeug utilities, never as plaintext.
- Flask's signed session cookie tracks the logged-in user; a secret key is supplied through environment configuration.
- SQL statements use bound parameters. Templates rely on Jinja's autoescaping for user-provided content.
- Python's `unittest` and temporary SQLite databases exercise account, authorization, post, and persistence behavior.

## Initial scope

Included:

- Registration, login, and logout.
- Public post list and detail pages.
- Authenticated post creation.
- Owner-only post editing and deletion.
- Basic input validation and user-facing error messages.
- A README with setup, configuration, run, and test instructions.

Not included in the initial version:

- Password reset, email verification, roles, comments, image uploads, rich text, or an admin dashboard.
- Production hosting or a multi-process deployment configuration.

## Acceptance criteria

1. A new user can register, log in, create a post, and log out.
2. Logged-out users cannot create posts.
3. Users cannot edit or delete another user's posts.
4. Invalid registrations and invalid login attempts do not create an authenticated session.
5. Posts and users persist after the application is restarted.
6. Automated tests cover the above behavior using an isolated temporary database.
7. Setup and test commands are documented and work from the project directory.

## Review questions

- Should posts be publicly readable, or should reading also require login?
- Should editing and deleting be limited to the post's author, or should users only be able to create posts?
- Is a username sufficient for registration, or is an email address required?
- Are the proposed post fields (title and body) sufficient for the first version?
