import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { Authenticator } from "@aws-amplify/ui-react";
import { useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { I18n } from "aws-amplify/utils";
import { translations } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import "../../ThemeAuth.css";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();
  const { language } = useLanguage();

  // Set Amplify UI language based on the current app language
  useEffect(() => {
    I18n.putVocabularies(translations);
    I18n.setLanguage(language);
  }, [language]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="auth-header">
          <h2 className="auth-title">{t("common.appName")}</h2>
          {/* <p className="auth-description">{t("auth.appDescription")}</p> */}
        </div>
        <div className="auth-wrapper">
          <Authenticator
            initialState="signIn"
            loginMechanisms={["username"]}
            components={{
              SignIn: {
                Header() {
                  return (
                    <h3
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: "600",
                        textAlign: "center",
                      }}></h3>
                  );
                },
              },
              SignUp: {
                Header() {
                  return (
                    <h3
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: "600",
                        textAlign: "center",
                      }}></h3>
                  );
                },
              },
            }}>
            {/* Ignore the destructured props since we don't use them */}
            {(_) => {
              // Redirect on successful auth. Use the app base so it respects
              // the API Gateway stage prefix (e.g. "/app/").
              window.location.href = import.meta.env.BASE_URL || "/";
              return <div></div>;
            }}
          </Authenticator>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
