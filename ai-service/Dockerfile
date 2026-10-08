# OneHealth AI - OCR / extraction / summary service.
# Build:  docker build -t onehealth-ai ./ai-service
# Optional spaCy clinical NER:  --build-arg WITH_SPACY=true  (otherwise the
# service uses its rule-based engine, which is what the evaluation measured).
FROM python:3.12-slim

ARG WITH_SPACY=false
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 HOST=0.0.0.0 PORT=8001
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN if [ "$WITH_SPACY" = "true" ]; then pip install --no-cache-dir -r requirements.txt; \
    else grep -v -E '^(spacy|medspacy)' requirements.txt > /tmp/req.txt \
         && pip install --no-cache-dir -r /tmp/req.txt; fi

COPY app ./app
RUN useradd --create-home runner && chown -R runner /app
USER runner
EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
