import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Modal from "../../../components/Modal";
import Button from "../../../components/Button";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDontShowAgain: () => void;
}

// 6つの業界カテゴリ定義
const industries = [
  { tag: "real-estate", icon: "🏢" },
  { tag: "it-department", icon: "💼" },
  { tag: "manufacturing", icon: "🏭" },
  { tag: "sustainability", icon: "🌱" },
  { tag: "corporate-governance", icon: "📋" },
  { tag: "healthcare", icon: "💊" },
] as const;

/**
 * 初回ログイン時のオンボーディングモーダル
 * 具体的な業界サンプルで即座に始められることを強調
 */
export default function OnboardingModal({
  isOpen,
  onClose,
  onDontShowAgain,
}: OnboardingModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      onDontShowAgain();
    }
    onClose();
  };

  const handleExploreExamples = () => {
    if (dontShowAgain) {
      onDontShowAgain();
    }
    onClose();
    navigate("/examples");
  };

  // タグキーを i18n キーに変換（例: "real-estate" -> "RealEstate"）
  const formatTagKey = (tag: string) => {
    return tag
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="" size="xl" dismissible={false}>
      <div className="py-8 px-6">
        {/* Hero Section */}
        <div className="text-center mb-8">
          {/* タイトル */}
          <h2 className="text-2xl font-bold text-aws-font-color-light dark:text-aws-font-color-dark mb-4">
            {t("examples.onboarding.title")}
          </h2>

          {/* Primary Message - 大きく太字 */}
          <p className="text-xl font-bold text-aws-font-color-light dark:text-aws-font-color-dark mb-2 leading-relaxed">
            {t("examples.onboarding.primaryMessage")}
          </p>
        </div>

        {/* Industry Showcase Section */}
        <div className="mt-8">
          {/* Section Label */}
          <p className="text-sm text-aws-font-color-gray text-center mb-4">
            {t("examples.onboarding.industriesLabel")}
          </p>

          {/* Industry Pills Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
            {industries.map(({ tag, icon }) => (
              <div
                key={tag}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full
                           bg-aws-paper-light dark:bg-aws-paper-dark
                           text-aws-font-color-light dark:text-aws-font-color-dark
                           text-sm font-medium
                           border border-light-gray dark:border-aws-ui-color-dark"
              >
                <span className="text-lg">{icon}</span>
                <span>{t(`examples.tag${formatTagKey(tag)}`)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Value Proposition Section */}
        <div className="mt-6 text-center">
          <p className="text-base text-aws-font-color-gray max-w-xl mx-auto">
            {t("examples.onboarding.valueProposition")}
          </p>
        </div>

        {/* Action Section */}
        <div className="mt-8 space-y-6">
          {/* Single Primary CTA */}
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={handleExploreExamples}>
            {t("examples.onboarding.exploreExamples")}
          </Button>

          {/* 今後表示しないチェックボックス */}
          <label htmlFor="dont-show-again" className="flex items-center justify-center gap-2 cursor-pointer">
            <input
              id="dont-show-again"
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 text-aws-sea-blue-light border-aws-font-color-gray dark:border-aws-font-color-dark rounded focus:ring-aws-sea-blue-light focus:ring-2"
            />
            <span className="text-sm text-aws-font-color-gray">
              {t("examples.onboarding.dontShowAgain")}
            </span>
          </label>
        </div>
      </div>
    </Modal>
  );
}
