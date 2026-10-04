FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Create a non-root user for security
RUN adduser --disabled-password --gecos '' appuser
USER appuser
EXPOSE 8000
# --reload is intentionally omitted — use it only in development
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
