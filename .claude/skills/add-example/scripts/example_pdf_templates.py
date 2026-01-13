#!/usr/bin/env python3
"""
PDF Template Examples for add-example skill

This module provides reference implementations for three common PDF layout patterns
based on UC007 (Pharmaceutical Regulatory Review use case).

Usage:
    python example_pdf_templates.py

Patterns:
    1. Two-Column Table Layout (Checklist)
    2. Section Header Layout (Evaluation Document)
    3. Chapter Structure Layout (Guideline/Reference)

Note: These are examples based on the pharmaceutical domain. Other domains may require
completely different approaches. Always consider the culture and conventions of your
target domain.
"""

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.lib.colors import HexColor, white, black

# Register Japanese font for PDF generation
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))


# =============================================================================
# Pattern 1: Two-Column Table Layout (Checklist)
# =============================================================================

def create_two_column_table_pdf(output_path, title, subtitle, items):
    """
    Create a PDF with two-column table layout suitable for checklists.

    Args:
        output_path (str): Output PDF file path
        title (str): Document title
        subtitle (str): Document subtitle
        items (list): List of dicts with 'num', 'title', 'desc' keys

    Example:
        items = [
            {
                "num": "1",
                "title": "Item Title",
                "desc": "Description text for this item"
            },
            ...
        ]
    """
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4

    # Color scheme: Blue (for checklists)
    blue_header = HexColor('#1E40AF')
    blue_light = HexColor('#DBEAFE')
    blue_text = HexColor('#1E40AF')
    gray = HexColor('#6B7280')

    page_num = 1

    # Draw header/footer
    def draw_header_footer():
        nonlocal page_num
        # Header background
        c.setFillColor(blue_header)
        c.rect(0, height - 50, width, 50, fill=True, stroke=False)

        # Title
        c.setFillColor(white)
        c.setFont('HeiseiKakuGo-W5', 14)
        c.drawString(50, height - 30, title)

        # Subtitle
        c.setFont('HeiseiKakuGo-W5', 9)
        c.drawString(50, height - 42, subtitle)

        # Footer
        c.setFillColor(gray)
        c.setFont('HeiseiKakuGo-W5', 8)
        c.drawString(50, 30, "Document Category")
        c.drawRightString(width - 50, 30, f"Page {page_num}")

    draw_header_footer()

    # Table setup
    y = height - 80
    row_height = 65

    # Table header
    c.setFillColor(blue_header)
    c.rect(50, y - 20, 80, 20, fill=True, stroke=False)
    c.rect(130, y - 20, width - 180, 20, fill=True, stroke=False)

    c.setFillColor(white)
    c.setFont('HeiseiKakuGo-W5', 10)
    c.drawString(70, y - 13, "Item")
    c.drawString(250, y - 13, "Description")

    y -= 20

    # Table rows
    for i, item in enumerate(items):
        if y < 100:  # Page break
            c.showPage()
            page_num += 1
            draw_header_footer()
            y = height - 80

        # Alternating row background
        if i % 2 == 0:
            c.setFillColor(blue_light)
            c.rect(50, y - row_height, width - 100, row_height, fill=True, stroke=False)

        # Draw borders
        c.setStrokeColor(blue_header)
        c.setLineWidth(0.5)
        c.rect(50, y - row_height, 80, row_height, fill=False, stroke=True)
        c.rect(130, y - row_height, width - 180, row_height, fill=False, stroke=True)

        # Item number and title (left column)
        c.setFillColor(blue_text)
        c.setFont('HeiseiKakuGo-W5', 16)
        c.drawCentredString(90, y - 25, item["num"])

        c.setFillColor(black)
        c.setFont('HeiseiKakuGo-W5', 9)
        c.drawString(60, y - 40, item["title"])

        # Description (right column) - text wrapping
        c.setFont('HeiseiKakuGo-W5', 8)
        lines = []
        line = ""
        max_width = width - 200
        for char in item["desc"]:
            test_line = line + char
            if c.stringWidth(test_line, 'HeiseiKakuGo-W5', 8) > max_width:
                lines.append(line)
                line = char
            else:
                line = test_line
        if line:
            lines.append(line)

        text_y = y - 20
        for line in lines[:3]:  # Max 3 lines
            c.drawString(140, text_y, line)
            text_y -= 12

        y -= row_height

    c.save()


# =============================================================================
# Pattern 2: Section Header Layout (Evaluation Document)
# =============================================================================

def create_section_header_pdf(output_path, title, subtitle, sections):
    """
    Create a PDF with section headers suitable for evaluation documents.

    Args:
        output_path (str): Output PDF file path
        title (str): Document title
        subtitle (str): Document subtitle
        sections (list): List of dicts with 'num', 'title', 'lines' keys

    Example:
        sections = [
            {
                "num": "1",
                "title": "Section Title",
                "lines": ["Line 1 text", "Line 2 text", ...]
            },
            ...
        ]
    """
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4

    # Color scheme: Green (for review documents)
    green_header = HexColor('#047857')
    green_light = HexColor('#D1FAE5')
    green_text = HexColor('#047857')
    gray = HexColor('#6B7280')

    page_num = 1

    # Draw header/footer
    def draw_header_footer():
        nonlocal page_num
        c.setFillColor(green_header)
        c.rect(0, height - 50, width, 50, fill=True, stroke=False)

        c.setFillColor(white)
        c.setFont('HeiseiKakuGo-W5', 14)
        c.drawString(50, height - 30, title)

        c.setFont('HeiseiKakuGo-W5', 9)
        c.drawString(50, height - 42, subtitle)

        c.setFillColor(gray)
        c.setFont('HeiseiKakuGo-W5', 8)
        c.drawString(50, 30, "Document Category")
        c.drawRightString(width - 50, 30, f"Page {page_num}")

    # Draw section header
    def draw_section_header(y, section_num, section_title):
        c.setFillColor(green_light)
        c.rect(50, y - 25, width - 100, 25, fill=True, stroke=False)

        c.setFillColor(green_text)
        c.setFont('HeiseiKakuGo-W5', 11)
        c.drawString(60, y - 17, f"{section_num}. {section_title}")
        return y - 35

    draw_header_footer()
    y = height - 70

    for section in sections:
        if y < 100:
            c.showPage()
            page_num += 1
            draw_header_footer()
            y = height - 70

        y = draw_section_header(y, section["num"], section["title"])

        c.setFillColor(black)
        c.setFont('HeiseiKakuGo-W5', 8)

        for line in section["lines"]:
            if y < 80:
                c.showPage()
                page_num += 1
                draw_header_footer()
                y = height - 70

            c.drawString(60, y, line)
            y -= 12

        y -= 10  # Extra space between sections

    c.save()


# =============================================================================
# Pattern 3: Chapter Structure Layout (Guideline/Reference)
# =============================================================================

def create_chapter_structure_pdf(output_path, title, category, content):
    """
    Create a PDF with chapter structure suitable for guidelines and references.

    Args:
        output_path (str): Output PDF file path
        title (str): Document title
        category (str): Document category
        content (list): List of dicts with 'type', 'num', 'title', 'lines' keys

    Example:
        content = [
            {
                "type": "chapter",
                "num": "1",
                "title": "Chapter Title"
            },
            {
                "type": "text",
                "lines": ["Content line 1", "Content line 2", ...]
            },
            ...
        ]
    """
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4

    # Color scheme: Gray (for reference materials)
    gray_header = HexColor('#374151')
    gray_light = HexColor('#F3F4F6')
    gray_text = HexColor('#4B5563')

    page_num = 1

    # Draw header/footer
    def draw_header_footer():
        nonlocal page_num
        c.setFillColor(gray_header)
        c.rect(0, height - 50, width, 50, fill=True, stroke=False)

        c.setFillColor(white)
        c.setFont('HeiseiKakuGo-W5', 14)
        c.drawString(50, height - 30, title)

        c.setFont('HeiseiKakuGo-W5', 9)
        c.drawString(50, height - 42, category)

        c.setFillColor(gray_text)
        c.setFont('HeiseiKakuGo-W5', 8)
        c.drawString(50, 30, "Reference Document")
        c.drawRightString(width - 50, 30, f"Page {page_num}")

    # Draw chapter header
    def draw_chapter(y, num, chapter_title):
        c.setFillColor(gray_light)
        c.rect(50, y - 30, width - 100, 30, fill=True, stroke=False)

        c.setFillColor(gray_header)
        c.setFont('HeiseiKakuGo-W5', 12)
        c.drawString(60, y - 18, f"{num}. {chapter_title}")
        return y - 40

    draw_header_footer()
    y = height - 70

    c.setFillColor(black)
    c.setFont('HeiseiKakuGo-W5', 8)

    for item in content:
        if item['type'] == 'chapter':
            if y < 100:
                c.showPage()
                page_num += 1
                draw_header_footer()
                y = height - 70
            y = draw_chapter(y, item['num'], item['title'])
        else:
            for line in item['lines']:
                if y < 80:
                    c.showPage()
                    page_num += 1
                    draw_header_footer()
                    y = height - 70
                c.drawString(60, y, line)
                y -= 11

    c.save()


# =============================================================================
# Example Usage
# =============================================================================

def main():
    """
    Generate example PDFs demonstrating the three layout patterns.
    """
    print("Generating example PDF templates...")

    # Example 1: Two-Column Table (Checklist)
    checklist_items = [
        {
            "num": "1",
            "title": "First Item",
            "desc": "This is a description of the first checklist item with sufficient detail."
        },
        {
            "num": "2",
            "title": "Second Item",
            "desc": "This is a description of the second checklist item."
        },
    ]

    create_two_column_table_pdf(
        "/tmp/example_checklist.pdf",
        "Example Checklist",
        "Two-Column Table Layout",
        checklist_items
    )
    print("✅ Created: /tmp/example_checklist.pdf")

    # Example 2: Section Headers (Evaluation Document)
    sections = [
        {
            "num": "1",
            "title": "Introduction",
            "lines": [
                "This section introduces the evaluation document.",
                "It provides context and background information.",
            ]
        },
        {
            "num": "2",
            "title": "Methodology",
            "lines": [
                "This section describes the evaluation methodology.",
                "Key approaches and techniques are outlined here.",
            ]
        },
    ]

    create_section_header_pdf(
        "/tmp/example_evaluation.pdf",
        "Example Evaluation Document",
        "Section Header Layout",
        sections
    )
    print("✅ Created: /tmp/example_evaluation.pdf")

    # Example 3: Chapter Structure (Guideline)
    guideline_content = [
        {
            "type": "chapter",
            "num": "1",
            "title": "Overview"
        },
        {
            "type": "text",
            "lines": [
                "This guideline provides comprehensive information.",
                "It is organized into chapters for easy navigation.",
            ]
        },
        {
            "type": "chapter",
            "num": "2",
            "title": "Requirements"
        },
        {
            "type": "text",
            "lines": [
                "This chapter outlines the requirements.",
                "Each requirement is clearly documented.",
            ]
        },
    ]

    create_chapter_structure_pdf(
        "/tmp/example_guideline.pdf",
        "Example Guideline",
        "Reference Document",
        guideline_content
    )
    print("✅ Created: /tmp/example_guideline.pdf")

    print("\n✅ All example PDFs generated successfully!")


if __name__ == "__main__":
    main()
