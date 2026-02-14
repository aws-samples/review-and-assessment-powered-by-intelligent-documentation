#!/usr/bin/env python3
"""Generate English floor plan safety report PDF for Building A."""

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def create_building_a_page(c):
    """Create Building A fire safety inspection report."""
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 800, "Building A - Fire Safety Equipment Inspection Report")

    c.setFont("Helvetica", 10)
    c.drawString(50, 780, "Page 1/6")
    c.drawString(400, 780, "Inspection Date: December 15, 2025")

    y = 740
    content = [
        "Inspection Result: PASS",
        "",
        "[Fire Extinguishers]",
        "✓ 1st floor corridor: 2 ABC-type extinguishers - Installed, within valid date",
        "✓ 2nd floor corridor: 2 ABC-type extinguishers - Installed, within valid date",
        "✓ Underground parking: 1 large fire extinguisher - Installed, within valid date",
        "",
        "[Emergency Lighting]",
        "✓ All floor emergency lights: 20 units - Operational",
        "✓ Battery backup time: 90 minutes - Meets 60-minute code requirement",
        "✓ Regular inspection records: Complete",
        "",
        "[Exit Signs]",
        "✓ Exit signs on each floor: 8 units - Installed, good visibility",
        "✓ Illumination function: All operational",
        "",
        "Overall Assessment: All fire safety equipment meets Building Code",
        "and Fire Code requirements and is properly maintained.",
    ]

    for line in content:
        if line.startswith("["):
            c.setFont("Helvetica-Bold", 10)
        else:
            c.setFont("Helvetica", 10)
        c.drawString(50, y, line)
        y -= 20

    # Footer
    c.setFont("Helvetica", 8)
    c.drawString(50, 30, "Inspector: Fire Safety Inspection Co.")
    c.drawString(400, 30, "Report Number: FP-2025-001")


def main():
    output_file = "fixtures/floor_plan_safety_reports.pdf"
    c = canvas.Canvas(output_file, pagesize=A4)
    create_building_a_page(c)
    c.save()
    print(f"✓ Created: {output_file}")


if __name__ == "__main__":
    main()
