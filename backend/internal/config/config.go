// Package config loads server configuration from environment variables.
package config

import "os"

// Config holds all server settings, each backed by an environment variable.
type Config struct {
	Port            string // PORT, default "8090"
	DatabaseURL     string // DATABASE_URL; empty means "run without a database"
	DeepSeekAPIKey  string // DEEPSEEK_API_KEY
	DeepSeekBaseURL string // DEEPSEEK_BASE_URL, default "https://api.deepseek.com"
	JWTSecret       string // JWT_SECRET; empty disables the /api/users/* routes
}

// Load reads the configuration from the environment.
func Load() Config {
	return Config{
		Port:            envOr("PORT", "8090"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		DeepSeekAPIKey:  os.Getenv("DEEPSEEK_API_KEY"),
		DeepSeekBaseURL: envOr("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
		JWTSecret:       os.Getenv("JWT_SECRET"),
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
