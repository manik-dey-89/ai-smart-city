FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Create a non-root user for security
RUN adduser --disabled-password --gecos '' appuser && \
    chmod +x start.sh
USER appuser
EXPOSE 8000
# start.sh seeds the DB then launches uvicorn (idempotent — safe on every restart)
CMD ["bash", "start.sh"]
