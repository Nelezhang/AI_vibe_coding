# The Blog Notebook

A private Pygame desktop blog. Create, edit, and delete posts, add comma-separated tags, and search titles, tags, or post text. This is a local notebook, not a public website; no server or account is required.

## Run

From the workspace root:

```bash
source .venv-1/bin/activate
python -m pip install -r "blog notebook/requirements.txt"
python "blog notebook/main.py"
```

Posts are stored in `~/.blog-notebook/posts.sqlite3` and persist between runs. Back up that file to keep your posts; deleting it removes them.

## Controls

- Click **+ New**, a post, or an editor field.
- Type in the selected field. Use the left/right arrows to move the cursor, Backspace or Delete to remove text, and Enter to add a new line in the story.
- Click **Save post** or press **Ctrl+S** (Mac: **Cmd+S**).
- Click **Delete** and confirm to permanently delete a saved post.
- Use the search box to filter titles, tags, and story text. Scroll the post list or story with the mouse wheel.
- Press **Tab** to move between fields; **Esc** exits. Unsaved changes require confirmation before switching posts or exiting.

## Tests

```bash
cd "blog notebook"
../.venv-1/bin/python -m unittest -v
```
