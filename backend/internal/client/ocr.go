package client

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

// OCRExtractor uses pdftoppm and tesseract to extract text from PDF scans.
type OCRExtractor struct{}

func NewOCRExtractor() *OCRExtractor { return &OCRExtractor{} }

// Extract converts PDF to images and runs OCR on them.
func (e *OCRExtractor) Extract(r io.Reader) (string, error) {
	// 1. Save PDF to temp file (pdftoppm needs a file)
	tmpDir, err := os.MkdirTemp("", "ocr-*")
	if err != nil {
		return "", fmt.Errorf("creating temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	pdfPath := filepath.Join(tmpDir, "input.pdf")
	f, err := os.Create(pdfPath)
	if err != nil {
		return "", fmt.Errorf("creating temp pdf: %w", err)
	}
	if _, err := io.Copy(f, r); err != nil {
		f.Close()
		return "", fmt.Errorf("writing temp pdf: %w", err)
	}
	f.Close()

	// 2. Convert PDF to PPM/PNG images using pdftoppm
	// pdftoppm -png input.pdf prefix
	cmdPPM := exec.Command("pdftoppm", "-png", pdfPath, filepath.Join(tmpDir, "page"))
	if out, err := cmdPPM.CombinedOutput(); err != nil {
		return "", fmt.Errorf("pdftoppm failed: %w (output: %s)", err, string(out))
	}

	// 3. Find all generated images
	files, err := filepath.Glob(filepath.Join(tmpDir, "page-*.png"))
	if err != nil {
		return "", fmt.Errorf("listing temp images: %w", err)
	}
	if len(files) == 0 {
		return "", fmt.Errorf("%w: no pages found in pdf", models.ErrUnreadablePDF)
	}

	// 4. Run Tesseract on each image
	var fullText strings.Builder
	for _, imgPath := range files {
		// tesseract img stdout -l eng+rus
		cmdTess := exec.Command("tesseract", imgPath, "stdout", "-l", "eng+rus")
		out, err := cmdTess.Output()
		if err != nil {
			// We don't fail the whole process if one page fails, but log it or skip
			continue
		}
		fullText.Write(out)
		fullText.WriteString("\n")
	}

	return fullText.String(), nil
}
