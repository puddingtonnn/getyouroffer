# Stage 1: Build
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod and sum files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server/main.go

# Stage 2: Final
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies (ca-certificates for HTTPS, tzdata for timezones)
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-rus

# Copy the binary from the builder stage
COPY --from=builder /app/server /app/server

# Copy migrations (if needed at runtime, though they are usually applied via make)
COPY --from=builder /app/migrations /app/migrations

# Expose the port the app runs on
EXPOSE 8090

# Run the server
CMD ["/app/server"]
