#!/bin/zsh
# Good Company — deploy to Hugging Face Spaces (the permanent link).
# Safe to re-run: creates the Space if missing, otherwise just pushes.
cd "$(dirname "$0")"

HF="$PWD/charisma-coach/.venv/bin/hf"
SPACE_NAME="good-company"

echo "Good Company — deploy"
echo "=================================================="

if [ ! -x "$HF" ]; then
  echo "  hf CLI missing. Install it with:"
  echo "  charisma-coach/.venv/bin/pip install huggingface_hub"
  exit 1
fi

# 1. Must be logged in. Token entry is interactive on purpose — it never
#    passes through a script and is stored in your keyring.
HF_USER=$("$HF" auth whoami 2>/dev/null | head -1)
if [ -z "$HF_USER" ] || [[ "$HF_USER" == *"Not logged in"* ]]; then
  echo "  Not logged in to Hugging Face."
  echo ""
  echo "  1. Make a free account:  https://huggingface.co/join"
  echo "  2. Make a WRITE token:   https://huggingface.co/settings/tokens"
  echo "  3. Run this, paste the token when asked:"
  echo ""
  echo "     $HF auth login"
  echo ""
  echo "  Then run this script again."
  exit 1
fi

echo "  Logged in as: $HF_USER"
REPO_ID="$HF_USER/$SPACE_NAME"

# 2. Create the Space if it isn't there yet.
if "$HF" repo info "$REPO_ID" --repo-type space >/dev/null 2>&1; then
  echo "  Space already exists: $REPO_ID"
else
  echo "  Creating Space: $REPO_ID"
  "$HF" repo create "$REPO_ID" --repo-type space --space-sdk docker --public || exit 1
fi

# 3. Point the 'space' git remote at it.
REMOTE="https://huggingface.co/spaces/$REPO_ID"
if git remote get-url space >/dev/null 2>&1; then
  git remote set-url space "$REMOTE"
else
  git remote add space "$REMOTE"
fi

# 4. Push. Requires the git credential helper to have your HF token; if it
#    prompts, the password is your HF *token*, not your account password.
echo "  Pushing to $REMOTE ..."
git push space main --force || {
  echo ""
  echo "  Push failed. If it asked for a password, use your HF WRITE token."
  exit 1
}

echo ""
echo "=================================================="
echo "  Deployed: https://${HF_USER//\//-}-${SPACE_NAME}.hf.space"
echo ""
echo "  ONE-TIME STEP — set the secrets in the Space UI:"
echo "    $REMOTE/settings"
echo "    Add secret: GEMINI_API_KEY = <your key>"
echo "    Add secret: APP_PASSCODE   = <door code — see backend/.env>"
echo ""
echo "  The Space rebuilds on every push. The URL never changes."
echo "=================================================="
