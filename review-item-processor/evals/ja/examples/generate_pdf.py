#!/usr/bin/env python3
"""Generate Japanese floor plan safety reports PDF."""

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

# Register Japanese font
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))

def create_page(c, page_num, building, scenario_type):
    """Create a single page for a building."""
    c.setFont('HeiseiKakuGo-W5', 16)
    c.drawString(50, 800, f"建物{building} - 消防設備点検報告書")

    c.setFont('HeiseiKakuGo-W5', 10)
    c.drawString(50, 780, f"ページ {page_num}/6")
    c.drawString(450, 780, "点検日: 2025年1月15日")

    y = 740

    if scenario_type == "clear_compliant":
        # Page 1: Building A - Clear compliant
        content = [
            "点検結果: 合格",
            "",
            "【消火器】",
            "✓ 1階廊下: ABC型消火器 2台 - 設置済み、有効期限内",
            "✓ 2階廊下: ABC型消火器 2台 - 設置済み、有効期限内",
            "✓ 地下駐車場: 大型消火器 1台 - 設置済み、有効期限内",
            "",
            "【非常灯】",
            "✓ 全フロア非常灯: 20台 - 正常動作確認済み",
            "✓ バッテリーバックアップ: 90分 - 基準値60分を満たす",
            "✓ 定期点検記録: 完備",
            "",
            "【出口標識】",
            "✓ 各階出口標識: 8台 - 設置済み、視認性良好",
            "✓ 照明機能: 全て正常",
            "",
            "総合評価: 全ての消防設備が建築基準法および消防法の要求",
            "事項を満たしており、適切に保守されています。"
        ]

    elif scenario_type == "clear_violation":
        # Page 2: Building B - Clear violation
        content = [
            "点検結果: 不合格",
            "",
            "【消火器】",
            "✗ 1階廊下: ABC型消火器 - 未設置（要求2台）",
            "✓ 2階廊下: ABC型消火器 2台 - 設置済み",
            "✗ 地下駐車場: 大型消火器 - 有効期限切れ（2024年6月期限）",
            "",
            "【非常灯】",
            "✗ 1階非常灯: 10台中3台が故障",
            "✓ 2階非常灯: 10台 - 正常動作",
            "？ バッテリーバックアップ: 点検未実施",
            "",
            "【出口標識】",
            "✗ 1階出口標識: 4台中2台の照明が不点灯",
            "✓ 2階出口標識: 4台 - 正常",
            "",
            "重大な不備:",
            "• 消火器の未設置および期限切れ",
            "• 非常灯の故障により避難経路の安全性に問題",
            "• 出口標識の照明不良",
            "",
            "総合評価: 消防設備に重大な不備があり、建築基準を満たして",
            "いません。直ちに是正が必要です。"
        ]

    elif scenario_type == "vague_compliant":
        # Page 3: Building C - Vague compliant
        content = [
            "点検結果: 概ね良好",
            "",
            "【全般】",
            "建物全体の消防設備は概ね適切に設置されています。",
            "",
            "【消火器】",
            "必要な箇所に消火器が配置されています。",
            "定期的な点検が実施されているようです。",
            "",
            "【非常灯】",
            "非常灯は各階に設置されており、機能しています。",
            "バッテリーのバックアップ機能もあります。",
            "",
            "【出口標識】",
            "出口標識は適切な位置に設置されています。",
            "",
            "備考:",
            "全体的な印象として、消防設備は基準を満たしていると",
            "考えられます。ただし、詳細な仕様や個別の点検記録に",
            "ついては別途確認が望ましいです。"
        ]

    elif scenario_type == "incomplete_info":
        # Page 4: Building D - Incomplete information
        content = [
            "点検結果: 情報不足のため判定保留",
            "",
            "【消火器】",
            "一部の消火器が確認できました。",
            "（詳細な台数、型式、設置場所の記録なし）",
            "",
            "【非常灯】",
            "非常灯の存在は確認しましたが、",
            "（動作確認記録なし）",
            "（バックアップ時間の記録なし）",
            "",
            "【出口標識】",
            "（点検記録なし）",
            "",
            "備考:",
            "この報告書では十分な情報が記載されていないため、",
            "建築基準への適合性を判断することができません。",
            "",
            "追加で必要な情報:",
            "• 消火器の詳細な設置位置と台数",
            "• 非常灯の動作確認記録",
            "• バッテリーバックアップ時間の測定結果",
            "• 出口標識の設置状況と点検記録"
        ]

    elif scenario_type == "partial_compliance":
        # Page 5: Building E - Partial compliance
        content = [
            "点検結果: 部分的に不合格",
            "",
            "【消火器】",
            "✓ 1階廊下: ABC型消火器 2台 - 設置済み、正常",
            "✓ 2階廊下: ABC型消火器 2台 - 設置済み、正常",
            "✓ 地下駐車場: 大型消火器 1台 - 設置済み、正常",
            "",
            "【非常灯】",
            "✓ 1階非常灯: 10台 - 正常動作",
            "✓ 2階非常灯: 10台 - 正常動作",
            "✓ バッテリーバックアップ: 75分 - 基準値60分を満たす",
            "",
            "【出口標識】",
            "✓ 1階出口標識: 4台 - 設置済み、正常",
            "✗ 2階出口標識: 4台中1台が破損",
            "✗ 2階北側出口: 標識が視界を遮られている（棚で隠れている）",
            "",
            "不備の詳細:",
            "• 2階の出口標識1台が物理的に破損",
            "• 設置後の什器配置により標識が隠れている",
            "",
            "総合評価: 消火器と非常灯は基準を満たしていますが、",
            "出口標識に不備があり、是正が必要です。"
        ]

    else:  # subtle_violation
        # Page 6: Building F - Subtle violation (45 min vs 60 min)
        content = [
            "点検結果: 合格",
            "",
            "【消火器】",
            "✓ 1階廊下: ABC型消火器 2台 - 設置済み、有効期限内",
            "✓ 2階廊下: ABC型消火器 2台 - 設置済み、有効期限内",
            "✓ 3階廊下: ABC型消火器 2台 - 設置済み、有効期限内",
            "✓ 地下駐車場: 大型消火器 1台 - 設置済み、有効期限内",
            "",
            "【非常灯】",
            "✓ 全フロア非常灯: 30台 - 正常動作確認済み",
            "✓ バッテリーバックアップ: 45分",
            "✓ 定期点検記録: 完備",
            "✓ LED型で省電力設計",
            "",
            "【出口標識】",
            "✓ 各階出口標識: 12台 - 設置済み、視認性良好",
            "✓ 照明機能: 全て正常",
            "✓ 最新の高輝度LED採用",
            "",
            "備考: 全ての設備が適切に機能しており、定期点検も",
            "実施されています。特に非常灯は最新のLED型を採用し、",
            "省電力化が図られています。",
            "",
            "総合評価: 消防設備は良好な状態で保守されています。"
        ]

    for line in content:
        c.setFont('HeiseiKakuGo-W5', 10)
        c.drawString(50, y, line)
        y -= 20

    # Footer
    c.setFont('HeiseiKakuGo-W5', 8)
    c.drawString(50, 30, f"点検者: 消防設備点検株式会社")
    c.drawString(400, 30, f"報告書番号: FP-2025-00{page_num}")

def main():
    output_file = "fixtures/floor_plan_safety_reports.pdf"
    c = canvas.Canvas(output_file, pagesize=A4)

    scenarios = [
        ("A", "clear_compliant"),
        ("B", "clear_violation"),
        ("C", "vague_compliant"),
        ("D", "incomplete_info"),
        ("E", "partial_compliance"),
        ("F", "subtle_violation")
    ]

    for page_num, (building, scenario) in enumerate(scenarios, 1):
        create_page(c, page_num, building, scenario)
        c.showPage()

    c.save()
    print(f"✓ Created: {output_file}")

if __name__ == "__main__":
    main()
