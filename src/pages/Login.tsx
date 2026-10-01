import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/ui";

type LoginView = "sign-in" | "forgot" | "sent" | "reset" | "updated";

const fieldClass =
  "h-[60px] w-full rounded-2xl border border-slate-200 bg-white pl-20 pr-5 text-base text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 sm:text-lg";

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function emailErrorFor(value: string) {
  return isValidEmailAddress(value) ? "" : "Please enter a valid email address.";
}

function passwordErrorFor(value: string) {
  return value.length >= 8 ? "" : "Password must be at least 8 characters.";
}

export default function Login() {
  const { signIn, completePasswordSetup, requestPasswordReset, completePasswordReset } =
    useAuth();
  const [view, setView] = useState<LoginView>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetReady, setResetReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [setupMode, setSetupMode] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("reset");
    if (!token) return;
    setResetToken(token);
    setView("reset");
  }, []);

  function clearFieldErrors() {
    setError("");
    setEmailError("");
    setPasswordError("");
    setConfirmError("");
  }

  function backToSignIn() {
    setView("sign-in");
    setSetupMode(false);
    setPassword("");
    setConfirmPassword("");
    setResetToken("");
    setResetReady(false);
    setShowPassword(false);
    clearFieldErrors();
    if (window.location.pathname !== "/login" || window.location.search) {
      window.history.replaceState(null, "", "/login");
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextEmailError = emailErrorFor(email);
    const nextPasswordError = passwordErrorFor(password);
    const nextConfirmError =
      setupMode && password !== confirmPassword ? "Passwords do not match." : "";
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    setError("");
    if (nextEmailError || nextPasswordError || nextConfirmError) return;

    setLoading(true);
    if (setupMode) {
      const setup = await completePasswordSetup(email, password, remember);
      if (setup.error) setError(setup.error);
      setLoading(false);
      return;
    }

    const result = await signIn(email, password, remember);
    if (result.needsPasswordSetup) {
      setSetupMode(true);
      setPassword("");
      setConfirmPassword("");
      setPasswordError("");
      setLoading(false);
      return;
    }
    if (result.error) setError(result.error);
    setLoading(false);
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    const nextEmailError = emailErrorFor(email);
    setEmailError(nextEmailError);
    setError("");
    if (nextEmailError) return;

    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);
    if (result.status === "invalid_email") {
      setEmailError("Please enter a valid email address.");
      return;
    }
    if (result.status === "not_found") {
      setError("No account was found for this email.");
      return;
    }
    if (result.status === "send_failed") {
      setError("The reset email could not be sent.");
      return;
    }
    if (result.status === "email_not_configured") {
      setResetToken(result.token);
      setResetReady(true);
      setView("sent");
      return;
    }
    setResetReady(false);
    setView("sent");
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    const nextPasswordError = passwordErrorFor(password);
    const nextConfirmError =
      password !== confirmPassword ? "Passwords do not match." : "";
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    setError("");
    if (nextPasswordError || nextConfirmError) return;

    setLoading(true);
    const result = await completePasswordReset(resetToken, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setView("updated");
  };

  const title =
    view === "forgot"
      ? "Forgot Password"
      : view === "sent"
        ? "Password Reset"
        : view === "reset"
          ? "Reset Password"
          : view === "updated"
            ? "Password Updated"
            : setupMode
              ? "Set Password"
              : "Sign In";

  return (
    <div className="min-h-[100dvh] overflow-x-clip bg-gradient-to-br from-white via-white to-emerald-50/50">
      <div className="min-h-[100dvh] grid lg:grid-cols-[1.12fr_0.88fr]">
        <div className="hidden lg:flex min-h-[100dvh] items-center justify-center overflow-hidden px-8 xl:px-12">
          <div
            className="flex items-center justify-center overflow-hidden"
            style={{ width: 450, height: 330 }}
          >
            <Logo width={450} height={330} />
          </div>
        </div>

        <div className="flex min-h-[100dvh] items-center justify-center overflow-y-auto px-5 py-8 sm:px-8 lg:px-8 xl:px-12">
          <div className="w-full max-w-[520px] max-h-[94dvh] overflow-y-auto rounded-[28px] border border-slate-100 bg-white/95 px-6 py-7 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur sm:px-9 sm:py-8 lg:px-10">
            <div className="mb-8 flex justify-center lg:hidden">
              <Logo size={100} />
            </div>

            <div className="mb-6 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
              {setupMode && view === "sign-in" && (
                <p className="mx-auto mt-2 max-w-md text-sm leading-5 text-slate-500">
                  Create a password for {email}. You will be signed in after it is saved.
                </p>
              )}
              {view === "forgot" && (
                <p className="mx-auto mt-2 max-w-md text-sm leading-5 text-slate-500">
                  Enter the email registered on your account.
                </p>
              )}
            </div>

            {view === "sign-in" && (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-slate-800 sm:text-base"
                  >
                    Email
                  </label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex w-16 items-center justify-center rounded-l-2xl bg-emerald-50 text-brand-600 transition group-focus-within:bg-emerald-100">
                      <span className="material-symbols-rounded" style={{ fontSize: 24 }}>
                        mail
                      </span>
                    </div>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError("");
                        if (setupMode) setSetupMode(false);
                      }}
                      placeholder="name@company.com"
                      autoComplete="username"
                      className={fieldClass}
                    />
                  </div>
                  {emailError && (
                    <p className="mt-2 text-sm font-medium text-red-600">{emailError}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-semibold text-slate-800 sm:text-base"
                  >
                    Password
                  </label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex w-16 items-center justify-center rounded-l-2xl bg-emerald-50 text-brand-600 transition group-focus-within:bg-emerald-100">
                      <span className="material-symbols-rounded" style={{ fontSize: 24 }}>
                        lock
                      </span>
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError("");
                      }}
                      placeholder="Enter your password"
                      autoComplete={setupMode ? "new-password" : "current-password"}
                      className={`${fieldClass} pr-14`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-slate-400 transition hover:text-brand-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 24 }}>
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  {passwordError && (
                    <p className="mt-2 text-sm font-medium text-red-600">{passwordError}</p>
                  )}
                </div>

                {setupMode && (
                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="mb-2 block text-sm font-semibold text-slate-800 sm:text-base"
                    >
                      Confirm Password
                    </label>
                    <div className="group relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex w-16 items-center justify-center rounded-l-2xl bg-emerald-50 text-brand-600">
                        <span className="material-symbols-rounded" style={{ fontSize: 24 }}>
                          lock
                        </span>
                      </div>
                      <input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setConfirmError("");
                        }}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        className={fieldClass}
                      />
                    </div>
                    {confirmError && (
                      <p className="mt-2 text-sm font-medium text-red-600">{confirmError}</p>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex cursor-pointer select-none items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span className="text-sm font-medium text-slate-600 sm:text-base">
                      Remember Me
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setView("forgot");
                      setPassword("");
                      clearFieldErrors();
                    }}
                    className="text-left text-sm font-semibold text-brand-600 transition hover:text-brand-700 sm:text-base"
                  >
                    Forgot Password?
                  </button>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 flex h-[56px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-600 px-6 text-lg font-bold text-white shadow-[0_12px_30px_rgba(22,163,74,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(22,163,74,0.34)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-xl"
                >
                  {loading ? (
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <span className="relative flex w-full items-center justify-center">
                      <span>{setupMode ? "Save Password" : "Sign In"} </span>
                      <span
                        className="material-symbols-rounded absolute right-0"
                        style={{ fontSize: 26 }}
                      >
                        arrow_forward
                      </span>
                    </span>
                  )}
                </button>
              </form>
            )}

            {view === "forgot" && (
              <form onSubmit={handleForgot} noValidate className="space-y-5">
                <div>
                  <label
                    htmlFor="reset-email"
                    className="mb-2 block text-sm font-semibold text-slate-800 sm:text-base"
                  >
                    Email
                  </label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex w-16 items-center justify-center rounded-l-2xl bg-emerald-50 text-brand-600 transition group-focus-within:bg-emerald-100">
                      <span className="material-symbols-rounded" style={{ fontSize: 24 }}>
                        mail
                      </span>
                    </div>
                    <input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError("");
                        setError("");
                      }}
                      placeholder="Enter your registered email"
                      autoComplete="username"
                      className={fieldClass}
                    />
                  </div>
                  {emailError && (
                    <p className="mt-2 text-sm font-medium text-red-600">{emailError}</p>
                  )}
                </div>
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-[56px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-600 px-6 text-lg font-bold text-white shadow-[0_12px_30px_rgba(22,163,74,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
                <button
                  type="button"
                  onClick={backToSignIn}
                  className="w-full text-center text-sm font-semibold text-brand-600"
                >
                  Back to Sign In
                </button>
              </form>
            )}

            {view === "sent" && (
              <div className="space-y-5">
                <p className="text-center text-sm leading-6 text-slate-600">
                  {resetReady
                    ? "Email delivery is not connected yet, so a reset link was not sent. You can set a new password for this account now."
                    : "Password reset link has been sent to your email."}
                </p>
                {resetReady ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPassword("");
                      setConfirmPassword("");
                      clearFieldErrors();
                      setView("reset");
                    }}
                    className="flex h-[56px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-600 px-6 text-lg font-bold text-white"
                  >
                    Set new password
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={backToSignIn}
                  className="w-full text-center text-sm font-semibold text-brand-600"
                >
                  Back to Sign In
                </button>
              </div>
            )}

            {view === "reset" && (
              <form onSubmit={handleReset} noValidate className="space-y-5">
                <div>
                  <label
                    htmlFor="new-password"
                    className="mb-2 block text-sm font-semibold text-slate-800 sm:text-base"
                  >
                    New Password
                  </label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex w-16 items-center justify-center rounded-l-2xl bg-emerald-50 text-brand-600">
                      <span className="material-symbols-rounded" style={{ fontSize: 24 }}>
                        lock
                      </span>
                    </div>
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError("");
                      }}
                      placeholder="Enter a new password"
                      autoComplete="new-password"
                      className={`${fieldClass} pr-14`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-slate-400 transition hover:text-brand-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 24 }}>
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  {passwordError && (
                    <p className="mt-2 text-sm font-medium text-red-600">{passwordError}</p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="confirm-new-password"
                    className="mb-2 block text-sm font-semibold text-slate-800 sm:text-base"
                  >
                    Confirm Password
                  </label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex w-16 items-center justify-center rounded-l-2xl bg-emerald-50 text-brand-600">
                      <span className="material-symbols-rounded" style={{ fontSize: 24 }}>
                        lock
                      </span>
                    </div>
                    <input
                      id="confirm-new-password"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setConfirmError("");
                      }}
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      className={fieldClass}
                    />
                  </div>
                  {confirmError && (
                    <p className="mt-2 text-sm font-medium text-red-600">{confirmError}</p>
                  )}
                </div>
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-[56px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-600 px-6 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    "Reset Password"
                  )}
                </button>
                <button
                  type="button"
                  onClick={backToSignIn}
                  className="w-full text-center text-sm font-semibold text-brand-600"
                >
                  Back to Sign In
                </button>
              </form>
            )}

            {view === "updated" && (
              <div className="space-y-5">
                <p className="text-center text-sm font-medium text-slate-700">
                  Password reset successfully.
                </p>
                <button
                  type="button"
                  onClick={backToSignIn}
                  className="flex h-[56px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-600 px-6 text-lg font-bold text-white"
                >
                  Back to Sign In
                </button>
              </div>
            )}

            {view === "sign-in" && (
              <p className="mt-6 text-center text-sm text-slate-500 sm:text-base">
                Need help?{" "}
                <span className="font-semibold text-brand-600">Contact your Administrator</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
