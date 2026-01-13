#!/usr/bin/env python3
"""
Generate AWS Security Audit PDFs for Use Case 008

Creates:
1. AWSセキュリティ監査チェックリスト.pdf - Checklist with 10 security items
2. AWSアカウント利用申請書.pdf - Application form from business division
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.lib.colors import HexColor, white, black

# Register Japanese font
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))

# AWS Color scheme
AWS_ORANGE = HexColor('#FF9900')
AWS_ORANGE_LIGHT = HexColor('#FFF5EB')
AWS_DARK = HexColor('#232F3E')
GRAY = HexColor('#6B7280')

# Security check items
SECURITY_ITEMS = [
    {
        "no": "1",
        "item": "RDS暗号化",
        "requirement": "全RDSインスタンスで保管時暗号化が有効",
    },
    {
        "no": "2",
        "item": "S3パブリックアクセス\nブロック",
        "requirement": "全S3バケットでパブリックアクセスブロック設定",
    },
    {
        "no": "3",
        "item": "IAM MFA",
        "requirement": "全IAMユーザーにMFA設定",
    },
    {
        "no": "4",
        "item": "CloudTrail",
        "requirement": "CloudTrailが全リージョンで有効",
    },
    {
        "no": "5",
        "item": "VPCフローログ",
        "requirement": "全VPCでフローログ有効",
    },
    {
        "no": "6",
        "item": "セキュリティグループ",
        "requirement": "危険ポート(22,3389等)の無制限アクセス禁止",
    },
    {
        "no": "7",
        "item": "EBS暗号化",
        "requirement": "全EBSボリュームで暗号化有効",
    },
    {
        "no": "8",
        "item": "IAMパスワード\nポリシー",
        "requirement": "14文字以上、複雑性要件満たすポリシー",
    },
    {
        "no": "9",
        "item": "AWS Config",
        "requirement": "AWS Config有効で記録中",
    },
    {
        "no": "10",
        "item": "GuardDuty",
        "requirement": "GuardDuty有効",
    },
]


def create_checklist_pdf(output_path):
    """Create AWS Security Audit Checklist PDF"""
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4

    # Header
    c.setFillColor(AWS_ORANGE)
    c.rect(0, height - 60, width, 60, fill=True, stroke=False)

    c.setFillColor(white)
    c.setFont('HeiseiKakuGo-W5', 18)
    c.drawString(50, height - 30, "AWSセキュリティ監査チェックリスト")

    c.setFont('HeiseiKakuGo-W5', 10)
    c.drawString(50, height - 48, "情報システム部門 - クラウドセキュリティ基準")

    # Table header
    y = height - 90
    row_height = 65

    c.setFillColor(AWS_ORANGE)
    c.rect(40, y, 30, 20, fill=True, stroke=False)
    c.rect(70, y, 100, 20, fill=True, stroke=False)
    c.rect(170, y, 180, 20, fill=True, stroke=False)
    c.rect(350, y, 50, 20, fill=True, stroke=False)
    c.rect(400, y, 115, 20, fill=True, stroke=False)

    c.setFillColor(white)
    c.setFont('HeiseiKakuGo-W5', 9)
    c.drawCentredString(55, y + 6, "No.")
    c.drawCentredString(120, y + 6, "項目")
    c.drawCentredString(260, y + 6, "要件")
    c.drawCentredString(375, y + 6, "状態")
    c.drawCentredString(457, y + 6, "備考・コメント")

    y -= 20

    # Table rows
    for i, item in enumerate(SECURITY_ITEMS):
        # Alternating background
        if i % 2 == 1:
            c.setFillColor(AWS_ORANGE_LIGHT)
            c.rect(40, y - row_height, width - 80, row_height, fill=True, stroke=False)

        # Borders
        c.setStrokeColor(AWS_ORANGE)
        c.setLineWidth(0.5)
        c.rect(40, y - row_height, 30, row_height, fill=False, stroke=True)
        c.rect(70, y - row_height, 100, row_height, fill=False, stroke=True)
        c.rect(170, y - row_height, 180, row_height, fill=False, stroke=True)
        c.rect(350, y - row_height, 50, row_height, fill=False, stroke=True)
        c.rect(400, y - row_height, 115, row_height, fill=False, stroke=True)

        # Content
        c.setFillColor(AWS_DARK)
        c.setFont('HeiseiKakuGo-W5', 10)
        c.drawCentredString(55, y - 30, item["no"])

        # Item name (multi-line support)
        c.setFont('HeiseiKakuGo-W5', 8)
        lines = item["item"].split("\n")
        line_y = y - 20 if len(lines) == 1 else y - 15
        for line in lines:
            c.drawString(75, line_y, line)
            line_y -= 12

        # Requirement (wrap text)
        c.setFont('HeiseiKakuGo-W5', 7)
        req_text = item["requirement"]
        if len(req_text) > 50:
            # Simple wrapping
            words = req_text
            c.drawString(175, y - 20, words[:50])
            c.drawString(175, y - 32, words[50:])
        else:
            c.drawString(175, y - 26, req_text)

        y -= row_height

        # Page break if needed
        if y < 100:
            c.showPage()
            y = height - 50

    # Footer
    c.setFillColor(GRAY)
    c.setFont('HeiseiKakuGo-W5', 8)
    c.drawString(50, 30, "作成日: 2025年1月")
    c.drawRightString(width - 50, 30, "Page 1")

    c.save()
    print(f"✓ Created: {output_path}")


def create_application_form_pdf(output_path):
    """Create AWS Account Application Form PDF"""
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4

    # Header
    c.setFillColor(AWS_ORANGE)
    c.rect(0, height - 50, width, 50, fill=True, stroke=False)

    c.setFillColor(white)
    c.setFont('HeiseiKakuGo-W5', 16)
    c.drawCentredString(width / 2, height - 30, "AWSアカウント利用申請書")

    y = height - 80

    # Applicant info section
    c.setFillColor(AWS_DARK)
    c.setFont('HeiseiKakuGo-W5', 10)

    c.drawString(50, y, "申請部門: DX推進部")
    y -= 20
    c.drawString(50, y, "申請者名: 山田 太郎")
    y -= 20
    c.drawString(50, y, "申請日: 2025年1月13日")
    y -= 40

    # Account info section
    c.setFillColor(AWS_ORANGE)
    c.rect(50, y - 5, width - 100, 25, fill=True, stroke=False)
    c.setFillColor(white)
    c.setFont('HeiseiKakuGo-W5', 11)
    c.drawString(55, y + 5, "AWSアカウント情報")

    y -= 35
    c.setFillColor(AWS_DARK)
    c.setFont('HeiseiKakuGo-W5', 9)
    c.drawString(50, y, "アカウントID: 123456789012")
    y -= 15
    c.drawString(50, y, "アカウント名: dx-promotion-dev")
    y -= 15
    c.drawString(50, y, "用途: 新規顧客管理システム開発環境")
    y -= 40

    # Security checklist section
    c.setFillColor(AWS_ORANGE)
    c.rect(50, y - 5, width - 100, 25, fill=True, stroke=False)
    c.setFillColor(white)
    c.setFont('HeiseiKakuGo-W5', 11)
    c.drawString(55, y + 5, "セキュリティ自己評価")

    y -= 30

    # Status symbols: ○ (compliant), × (non-compliant), △ (partial)
    statuses = ["○", "○", "×", "○", "×", "○", "○", "×", "○", "○"]
    notes = ["", "", "一部ユーザー未設定", "", "未設定", "", "", "最小長11文字", "", ""]

    c.setFont('HeiseiKakuGo-W5', 8)
    for i, item in enumerate(SECURITY_ITEMS[:10]):
        c.setFillColor(AWS_DARK)
        item_name = item["item"].replace("\n", "")
        c.drawString(55, y, f"{item['no']}. {item_name}")

        # Status
        status_color = AWS_DARK if statuses[i] == "○" else HexColor('#DC2626')
        c.setFillColor(status_color)
        c.drawString(250, y, statuses[i])

        # Notes
        c.setFillColor(GRAY)
        if notes[i]:
            c.drawString(280, y, notes[i])

        y -= 18

    y -= 20

    # Approval section
    c.setFillColor(AWS_ORANGE)
    c.rect(50, y - 5, width - 100, 25, fill=True, stroke=False)
    c.setFillColor(white)
    c.setFont('HeiseiKakuGo-W5', 11)
    c.drawString(55, y + 5, "承認欄")

    y -= 40
    c.setFillColor(AWS_DARK)
    c.setFont('HeiseiKakuGo-W5', 9)
    c.drawString(55, y, "申請者署名: _______________________    日付: _______")
    y -= 30
    c.drawString(55, y, "情シス承認: _______________________    日付: _______")

    # Footer
    c.setFillColor(GRAY)
    c.setFont('HeiseiKakuGo-W5', 8)
    c.drawCentredString(width / 2, 40, "情報システム部門審査用")

    c.save()
    print(f"✓ Created: {output_path}")


if __name__ == "__main__":
    # Get project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, "../../../.."))

    base_dir = os.path.join(project_root, "examples/ja/ユースケース008_AWSセキュリティ監査")

    # Create PDFs
    checklist_path = os.path.join(base_dir, "チェックリスト/AWSセキュリティ監査チェックリスト.pdf")
    application_path = os.path.join(base_dir, "審査対象書類/AWSアカウント利用申請書.pdf")

    print("Generating AWS Security Audit PDFs...")
    create_checklist_pdf(checklist_path)
    create_application_form_pdf(application_path)
    print("\n✅ PDF generation complete!")
