# Good Company — container image.
# Runs the real FastAPI backend unchanged: Gemini Live WebSocket bridge,
# analyzer, debrief, memory. Nothing is downgraded for hosting.

FROM python:3.12-slim

# Hugging Face Spaces runs containers as uid 1000; matching it keeps writes working.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY --chown=user charisma-coach/backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --user -r requirements.txt

COPY --chown=user charisma-coach/backend/  ./backend/
COPY --chown=user charisma-coach/frontend/ ./frontend/

# config.py derives FRONTEND_DIR as BACKEND_DIR.parent/"frontend" — /app/frontend. Correct here.
ENV HOST=0.0.0.0 \
    PORT=7860 \
    MEMORY_PATH=/home/user/data/memory.json

RUN mkdir -p /home/user/data

EXPOSE 7860
WORKDIR /app/backend

# Shell form on purpose: $PORT must expand at runtime. Render injects its own
# PORT; HF Spaces expects 7860, which is the default below.
CMD python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}
