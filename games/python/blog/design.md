# Blog System Design

## Page structure

### Shared navigation

- Site name links to the post list.
- Logged-out state shows **Log in** and **Register**.
- Logged-in state shows the username, **New post**, and **Log out**.
- Flash messages appear near the top of the page and explain successful or rejected actions.

### Post list (`/`)

- Shows recent posts in reverse chronological order.
- Each entry displays its title, author, publication date, and a short body excerpt.
- An empty state explains that no posts have been published yet.
- Logged-in users can navigate to the new-post form.

### Post detail (`/posts/<id>`)

- Shows the complete title, body, author, and timestamps.
- The author sees **Edit** and **Delete** controls for their own post.
- Unknown post IDs show a not-found response.

### Registration (`/register`)

- Fields: username and password, with password confirmation.
- Validation feedback appears beside or above the form.
- On success, the user is signed in and redirected to the post list (proposed behavior).

### Login (`/login`)

- Fields: username and password.
- Invalid credentials produce a generic message that does not reveal whether a username exists.
- On success, redirect to the page the user originally requested when safe, otherwise to the post list.

### Post form (`/posts/new`, `/posts/<id>/edit`)

- Fields: title and body.
- Preserve submitted values when validation fails.
- Show clear validation feedback; require a non-empty title and body.
- Cancel returns to the post list or the current post.
- Delete requires a POST action and a confirmation step.

## Visual direction

- Simple, readable, responsive layout with a centered content column.
- Clear hierarchy: site title, page heading, post title, then body text.
- Use high-contrast text, visible focus states, and appropriately labeled form controls.
- Keep styling lightweight and avoid a frontend framework for the first version.

## Proposed routes

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | Public | List recent posts |
| GET | `/posts/<id>` | Public | Read one post |
| GET, POST | `/register` | Public | Register an account |
| GET, POST | `/login` | Public | Authenticate |
| POST | `/logout` | Authenticated | End the session |
| GET, POST | `/posts/new` | Authenticated | Create a post |
| GET, POST | `/posts/<id>/edit` | Post author | Edit a post |
| POST | `/posts/<id>/delete` | Post author | Delete a post |

## Accessibility and feedback

- Associate each form label with its input and use appropriate input types.
- Ensure all actions work with keyboard focus and provide visible focus indicators.
- Use text in addition to color to communicate validation errors and success.
- Return standard not-found and forbidden/redirect behavior consistently.
