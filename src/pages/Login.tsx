import { useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/ui";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("admin@naturebiotic.com");
  const [password, setPassword] = useState("demo1234");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await signIn(email, password);
    setLoading(false);
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-white via-white to-emerald-50/50">
      <div className="h-full grid lg:grid-cols-[1.12fr_0.88fr]">
        {/* Left side — large logo */}
        <div className="hidden lg:flex h-full items-center justify-center overflow-hidden px-8 xl:px-12">
          <div
            className="flex items-center justify-center overflow-hidden"
            style={{ width: 450, height: 330 }}
          >
            <Logo width={450} height={330} />
          </div>
        </div>

        {/* Right side — login form */}
        <div className="flex h-full items-center justify-center overflow-hidden px-5 py-5 sm:px-8 lg:px-8 xl:px-12">
          <div className="w-full max-w-[520px] max-h-[94vh] overflow-hidden rounded-[28px] border border-slate-100 bg-white/95 px-6 py-7 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur sm:px-9 sm:py-8 lg:px-10">
            {/* Mobile logo */}
            <div className="mb-8 flex justify-center lg:hidden">
              <Logo size={100} />
            </div>

            <div className="mb-6 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Sign in to Continue
              </h1>
              {/* <p className="mx-auto mt-2 max-w-md text-sm leading-5 text-slate-500">
                Welcome back! Please enter your details to access your account.
              </p> */}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-slate-800 sm:text-base"
                >
                  Email
                </label>

                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex w-16 items-center justify-center rounded-l-2xl bg-emerald-50 text-brand-600 transition group-focus-within:bg-emerald-100">
                    <span
                      className="material-symbols-rounded"
                      style={{ fontSize: 24 }}
                    >
                      mail
                    </span>
                  </div>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@naturebiotic.com"
                    required
                    className="h-[60px] w-full rounded-2xl border border-slate-200 bg-white pl-20 pr-5 text-base text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 sm:text-lg"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-slate-800 sm:text-base"
                >
                  Password
                </label>

                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex w-16 items-center justify-center rounded-l-2xl bg-emerald-50 text-brand-600 transition group-focus-within:bg-emerald-100">
                    <span
                      className="material-symbols-rounded"
                      style={{ fontSize: 24 }}
                    >
                      lock
                    </span>
                  </div>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="h-[60px] w-full rounded-2xl border border-slate-200 bg-white pl-20 pr-5 text-base text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 sm:text-lg"
                  />
                </div>
              </div>

              {/* Remember and forgot */}
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
                  className="text-left text-sm font-semibold text-brand-600 transition hover:text-brand-700 sm:text-base"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Sign in */}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex h-[56px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-700 via-brand-600 to-emerald-600 px-6 text-lg font-bold text-white shadow-[0_12px_30px_rgba(22,163,74,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(22,163,74,0.34)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-xl"
              >
                {loading ? (
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <span className="relative flex w-full items-center justify-center">
                    <span>Sign In </span>
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

            <div className="my-5 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-sm font-medium text-slate-400">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <p className="text-center text-sm text-slate-500 sm:text-base">
              Need help?{" "}
              <span className="font-semibold text-brand-600">
                Contact your Administrator
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
