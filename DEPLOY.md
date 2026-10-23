# Deploying Deepfake Screener

The app runs as **one Docker container** (API + frontend + AI models) on a free
**Hugging Face Space**, with a free **MongoDB Atlas** database.

| Part | Service | Plan |
|---|---|---|
| App | Hugging Face Spaces (Docker) | CPU basic: free, 2 vCPU, 16 GB RAM, HTTPS |
| Database | MongoDB Atlas | M0: free, 512 MB |

Total time: about 20 minutes, most of it waiting for the first build.

---

## Step 1. Create the database (MongoDB Atlas)

1. Sign up at <https://www.mongodb.com/cloud/atlas/register>.
2. **Create a cluster** → choose **M0 (Free)** → provider **AWS**, region **Mumbai (ap-south-1)** (or the one closest
   to you) → **Create**.
3. **Database Access** → **Add New Database User** → *Password* authentication. Pick a username, click
   **Autogenerate Secure Password**, and save the password somewhere safe. Role: **Read and write to any database**.
4. **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`) → **Confirm**.
   Hugging Face doesn’t have fixed IP addresses, so this is required.
5. **Database** → **Connect** → **Drivers** → copy the connection string. It looks like:

   ```
   mongodb+srv://<user>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```

   Replace `<password>` with your password and add the database name `deepfake-detector` after the `/`:

   ```
   mongodb+srv://myuser:MyPassword123@cluster0.abcde.mongodb.net/deepfake-detector?retryWrites=true&w=majority
   ```

   This is your `MONGODB_URI`. Keep it private.

## Step 2. Create the Space (Hugging Face)

1. Sign up at <https://huggingface.co/join>.
2. Go to <https://huggingface.co/new-space>:
   - **Space name**: `deepfake-screener`
   - **SDK**: **Docker** → **Blank**
   - **Hardware**: **CPU basic · Free**
   - **Visibility**: Public (so judges can open it) → **Create Space**
3. In the Space, open **Settings** → **Variables and secrets** → **New secret**:
   - Name: `MONGODB_URI`
   - Value: the connection string from Step 1
4. Create an access token at <https://huggingface.co/settings/tokens> → **Create new token** → type **Write** →
   copy it. You’ll use it as the password when pushing.

## Step 3. Push the code to the Space

From the project folder (`deepfake-detector`), add the Space as a git remote (once):

```bash
git remote add space https://huggingface.co/spaces/<your-hf-username>/deepfake-screener
```

Then deploy the last commit:

```bash
npm run deploy:space
```

When asked, the username is your Hugging Face username and the password is the **token** from Step 2.

This sends the Space a single snapshot of your committed code, without git history. Hugging Face rejects pushes whose
history contains binary files, and the Space doesn’t need the history anyway. Uncommitted changes are not deployed,
so commit first.

## Step 4. Wait for the build

Open the Space page → **Logs** → **Build**. The build installs FFmpeg, builds the frontend and downloads the three
AI models (~530 MB); it takes about 5–10 minutes. When it finishes, the status turns **Running**.

## Step 5. Check it works

- App: `https://<your-hf-username>-deepfake-screener.hf.space`
- Health: `https://<your-hf-username>-deepfake-screener.hf.space/api/health` should show
  `"db":"connected"` and `"detector":"onnx"`.

Then try one image, one voice note and the Message check.

**Use the direct `.hf.space` link**, not the huggingface.co page, especially for **Live Call Guard**: browsers block
microphone and screen-audio capture inside the embedded frame on huggingface.co.

## Updating after changes

Commit as usual, then deploy again:

```bash
npm run deploy:space
```

The Space rebuilds automatically.

## Good to know

- **Sleeping:** a free Space sleeps after about 48 hours without visitors. The next visit wakes it in a minute or
  two, so open it shortly before a demo.
- **Storage:** uploaded files are deleted after scanning anyway; all results live in Atlas, so restarts lose nothing.
- **Speed:** on 2 vCPUs an image takes about 5 s and a short video about 30–60 s.
- **Privacy:** if the Space is public, anyone can use it and see the shared scan history.

## Troubleshooting

| Problem | Fix |
|---|---|
| `/api/health` shows `"db":"disconnected"` | Check the `MONGODB_URI` secret (password, database name) and that Atlas Network Access allows `0.0.0.0/0`. Restart the Space after changing secrets. |
| Build fails while downloading models | Re-run the build (**Settings → Factory rebuild**); Hugging Face downloads are occasionally interrupted. |
| `"detector":"stub"` | The models didn’t download during the build; check the build log for `models:download`. |
| Live Call Guard can’t access audio | Open the direct `.hf.space` link and allow the browser prompt. |
| Push asks for a password repeatedly | Use the **Write** token, not your account password. |

## Other hosts

The same `Dockerfile` runs on Railway, Render (2 GB+ plan), Fly.io or any VPS. Set `MONGODB_URI` (and optionally
`PORT`), and give the container at least 2 GB of RAM.
