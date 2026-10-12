import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Globe2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import "./index.css";

type Language = "en" | "ar";
type Feedback = { type: "success" | "error" | "info"; message: string } | null;

const copy = {
  en: {
    welcome: "WELCOME BACK",
    signInSubtitle: "Sign in to access your account",
    agency: "Internal Affairs Agency",
    emailLabel: "Email Address",
    emailPlaceholder: "Enter your email...",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password...",
    remember: "Remember Me",
    forgot: "Forgot Password?",
    signIn: "Sign In",
    signingIn: "Verifying access...",
    authorized: "AUTHORIZED PERSONNEL ONLY",
    secure: "SECURE CONNECTION",
    status: "All systems operational",
    language: "العربية",
    invalidEmail: "Enter a valid email address.",
    missingPassword: "Enter your password.",
    forgotMessage: "Password recovery is not connected yet. Contact your system administrator.",
    success: "Access granted. Welcome back to the IAA Portal.",
    privacy: "This demo keeps form data in your browser only.",
  },
  ar: {
    welcome: "مرحبًا بعودتك",
    signInSubtitle: "سجّل الدخول للوصول إلى حسابك",
    agency: "وكالة الشؤون الداخلية",
    emailLabel: "البريد الإلكتروني",
    emailPlaceholder: "أدخل بريدك الإلكتروني...",
    passwordLabel: "كلمة المرور",
    passwordPlaceholder: "أدخل كلمة المرور...",
    remember: "تذكّرني",
    forgot: "هل نسيت كلمة المرور؟",
    signIn: "تسجيل الدخول",
    signingIn: "جارٍ التحقق من الصلاحية...",
    authorized: "للموظفين المصرّح لهم فقط",
    secure: "اتصال آمن",
    status: "جميع الأنظمة تعمل بشكل طبيعي",
    language: "English",
    invalidEmail: "أدخل بريدًا إلكترونيًا صحيحًا.",
    missingPassword: "أدخل كلمة المرور.",
    forgotMessage: "استعادة كلمة المرور غير مرتبطة حاليًا. تواصل مع مسؤول النظام.",
    success: "تم السماح بالدخول. أهلًا بك مجددًا في بوابة IAA.",
    privacy: "يتم الاحتفاظ ببيانات النموذج داخل متصفحك فقط.",
  },
} as const;

const rememberedEmail = () => {
  try {
    return window.localStorage.getItem("iaa-remembered-email") ?? "";
  } catch {
    return "";
  }
};

export default function App() {
  const [language, setLanguage] = useState<Language>("en");
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() => Boolean(rememberedEmail()));
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const t = copy[language];
  const dir = language === "ar" ? "rtl" : "ltr";
  const emailIsInvalid = touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordIsInvalid = touched && password.length === 0;

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [dir, language]);

  const statusIcon = useMemo(() => {
    if (feedback?.type === "success") return <CheckCircle2 aria-hidden="true" />;
    if (feedback?.type === "error") return <CircleAlert aria-hidden="true" />;
    return <Activity aria-hidden="true" />;
  }, [feedback?.type]);

  const handleLanguageSwitch = () => {
    setLanguage((current) => (current === "en" ? "ar" : "en"));
    setFeedback(null);
    setTouched(false);
  };

  const handleForgotPassword = () => {
    setFeedback({ type: "info", message: t.forgotMessage });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    setFeedback(null);

    if (emailIsInvalid || passwordIsInvalid || !email || !password) {
      setFeedback({ type: "error", message: !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? t.invalidEmail : t.missingPassword });
      return;
    }

    if (remember) {
      try {
        window.localStorage.setItem("iaa-remembered-email", email);
      } catch {
        // Local storage can be unavailable in private browsing; login still works.
      }
    } else {
      try {
        window.localStorage.removeItem("iaa-remembered-email");
      } catch {
        // Ignore storage restrictions.
      }
    }

    setIsSubmitting(true);
    window.setTimeout(() => {
      setIsSubmitting(false);
      setFeedback({ type: "success", message: t.success });
    }, 900);
  };

  return (
    <main className="login-shell" dir={dir}>
      <div className="login-backdrop" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-lockup" aria-label="Internal Affairs Agency">
          <span className="brand-mark">IAA</span>
          <span className="brand-divider" />
          <span className="brand-copy">
            <strong>INTERNAL AFFAIRS AGENCY</strong>
            <small>LOS SANTOS</small>
          </span>
        </div>
        <div className="topbar-actions">
          <div className="connection-pill">
            <span className="online-dot" />
            <span>{t.secure}</span>
          </div>
          <button className="language-button" type="button" onClick={handleLanguageSwitch} aria-label={`Switch language to ${t.language}`}>
            <Globe2 size={15} aria-hidden="true" />
            {t.language}
          </button>
        </div>
      </header>

      <section className="portal-card" aria-labelledby="portal-title">
        <div className="corner-accent corner-accent-top" aria-hidden="true" />
        <div className="corner-accent corner-accent-bottom" aria-hidden="true" />

        <div className="portal-heading">
          <p className="eyebrow">{t.welcome}</p>
          <h1 id="portal-title"><span>IAA</span> PORTAL</h1>
          <div className="heading-rule"><span /></div>
          <p className="subtitle">{t.signInSubtitle}</p>
          <p className="agency-name">{t.agency}</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className={`field-group ${emailIsInvalid ? "has-error" : ""}`}>
            <label htmlFor="email">{t.emailLabel}</label>
            <div className="field-control">
              <Mail className="field-icon" size={21} aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t.emailPlaceholder}
                autoComplete="email"
                aria-invalid={emailIsInvalid}
                aria-describedby={emailIsInvalid ? "email-error" : undefined}
                onFocus={() => setFeedback(null)}
              />
            </div>
            {emailIsInvalid && <span className="field-error" id="email-error">{t.invalidEmail}</span>}
          </div>

          <div className={`field-group ${passwordIsInvalid ? "has-error" : ""}`}>
            <label htmlFor="password">{t.passwordLabel}</label>
            <div className="field-control">
              <LockKeyhole className="field-icon" size={21} aria-hidden="true" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t.passwordPlaceholder}
                autoComplete="current-password"
                aria-invalid={passwordIsInvalid}
                aria-describedby={passwordIsInvalid ? "password-error" : undefined}
                onFocus={() => setFeedback(null)}
              />
              <button
                type="button"
                className="visibility-button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={21} aria-hidden="true" /> : <Eye size={21} aria-hidden="true" />}
              </button>
            </div>
            {passwordIsInvalid && <span className="field-error" id="password-error">{t.missingPassword}</span>}
          </div>

          <div className="form-options">
            <label className="remember-control">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              <span className="custom-checkbox" aria-hidden="true" />
              <span>{t.remember}</span>
            </label>
            <button type="button" className="forgot-button" onClick={handleForgotPassword}>{t.forgot}</button>
          </div>

          <button className={`submit-button ${feedback?.type === "success" ? "is-success" : ""}`} type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="spin" size={22} aria-hidden="true" /> : feedback?.type === "success" ? <CheckCircle2 size={22} aria-hidden="true" /> : <ArrowRight size={24} aria-hidden="true" />}
            <span>{isSubmitting ? t.signingIn : feedback?.type === "success" ? (language === "ar" ? "تم الدخول" : "Access Granted") : t.signIn}</span>
          </button>
        </form>

        <div className={`feedback feedback-${feedback?.type ?? "idle"}`} role="status" aria-live="polite">
          <span className="feedback-icon">{statusIcon}</span>
          <span>{feedback?.message ?? t.status}</span>
        </div>

        <div className="security-note">
          <ShieldCheck size={33} strokeWidth={1.5} aria-hidden="true" />
          <div>
            <strong>{t.authorized}</strong>
            <span>IAA — INTERNAL AFFAIRS AGENCY</span>
          </div>
        </div>
        <p className="privacy-note">{t.privacy}</p>
      </section>

      <footer className="site-footer">
        <span>DEVELOPED BY SAADEX</span>
        <span className="footer-separator">|</span>
        <span>IAA SECURE TERMINAL</span>
      </footer>
    </main>
  );
}
