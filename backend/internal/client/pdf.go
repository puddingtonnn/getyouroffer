// PDFExtractor adapts a pure-Go PDF library to the service.ResumeExtractor
// port. The third-party dependency is isolated here; nothing outside this
// package knows the resume ever was a PDF.
package client

import (
	"bytes"
	"fmt"
	"io"
	"strings"

	"github.com/ledongthuc/pdf"

	"github.com/puddingtonnn/getyouroffer/backend/internal/models"
)

// PDFExtractor pulls plain text out of a PDF file.
type PDFExtractor struct{}

// NewPDFExtractor returns a ready-to-use PDFExtractor.
func NewPDFExtractor() *PDFExtractor { return &PDFExtractor{} }

// Extract reads the whole PDF and returns its plain text. Any parse failure
// is reported as models.ErrUnreadablePDF with the underlying cause attached;
// a PDF with no text layer (e.g. a scan) yields empty text, which the use
// case maps to ErrUnreadablePDF.
func (e *PDFExtractor) Extract(r io.Reader) (string, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return "", fmt.Errorf("%w: reading upload: %w", models.ErrUnreadablePDF, err)
	}
	if len(data) == 0 {
		return "", fmt.Errorf("%w: empty file", models.ErrUnreadablePDF)
	}

	text, err := readPlainText(data)
	if err != nil {
		return "", fmt.Errorf("%w: parsing pdf: %w", models.ErrUnreadablePDF, err)
	}
	return text, nil
}

// readPlainText isolates the library call and recovers from its occasional
// panics on malformed input, converting everything into a plain error.
func readPlainText(data []byte) (text string, err error) {
	defer func() {
		if r := recover(); r != nil {
			text = ""
			err = fmt.Errorf("pdf library panic: %v", r)
		}
	}()

	reader, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", err
	}

	buf, err := reader.GetPlainText()
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	if _, err := io.Copy(&sb, buf); err != nil {
		return "", err
	}
	return sb.String(), nil
}
