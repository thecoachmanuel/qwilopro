import React, { useEffect, useState } from "react";
import Logo from "../../assets/logo.svg";
import LogoDark from "../../assets/LogoDark.svg";
import { toast } from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isRestroUserAuthenticated } from "../../helpers/AuthStatus";
import {
  getUserDetailsInLocalStorage,
  saveUserDetailsInLocalStorage,
} from "../../helpers/UserDetails";
import { signIn } from "../../controllers/superadmin.controller";
import { useTheme } from "../../contexts/ThemeContext";

export default function SuperAdminLoginPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const restroAuthenticated = isRestroUserAuthenticated();
    if (restroAuthenticated) {
      const user = getUserDetailsInLocalStorage();
      if (!user) return;
      const { role } = user;
      if (role == "superadmin") {
        navigate("/admin/dashboard/home", {
          replace: true,
        });
        return;
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const username = e.target.username.value;
    const password = e.target.password.value;

    if (!username) {
      e.target.username.focus();
      toast.error(t("superadmin_login.username_error"));
      return;
    }

    if (!password) {
      e.target.password.focus();
      toast.error(t("superadmin_login.password_error"));
      return;
    }

    try {
      toast.loading(t("superadmin_login.loading_message"));

      const res = await signIn(username, password);

      if (res.status == 200) {
        toast.dismiss();
        toast.success(t("superadmin_login.success_message"));

        const user = res.data.user;
        saveUserDetailsInLocalStorage(user);

        if (res.data.accessToken) {
          localStorage.setItem("restroprosaas_token", res.data.accessToken);
        }

        navigate("/admin/dashboard/home", {
          replace: true,
        });
        return;
      } else {
        const message = res.data.message;
        toast.dismiss();
        toast.error(message);
        return;
      }
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message || t("superadmin_login.error_message");

      toast.dismiss();
      toast.error(message);
      return;
    }
  };

  return (
    <div className="relative overflow-x-hidden md:overflow-hidden bg-restro-green-light dark:bg-restro-card-bg">
      <img
        src="/assets/circle_illustration.svg"
        alt="illustration"
        className={`absolute w-96 lg:w-[1024px] h-96 lg:h-[1024px] lg:-bottom-96 lg:-right-52 -right-36 ${
          theme === "black" ? "opacity-80" : ""
        }`}
      />

      <div className="flex flex-col md:flex-row items-center justify-end md:justify-between gap-10 h-screen container mx-auto px-4 md:px-0 py-4 md:py-0 relative lg:px-12">
        <div>
          <h3 className="text-2xl lg:text-6xl font-black text-restro-green-dark dark:text-restro-green-dark-mode">
            {t("superadmin_login.title")}
          </h3>
          <h3
            className="text-2xl lg:text-6xl font-black outline-text text-transparent"
          >
            {t("superadmin_login.login")}.
          </h3>
        </div>

        <div
          className={`bg-white dark:bg-black border ${
            theme === "black"
              ? "border-restro-border-green"
              : "border-restro-green-light"
          } rounded-2xl px-8 py-8 w-full sm:w-96 mx-8 sm:mx-0 shadow-2xl`}
        >
          <div className="flex items-center justify-between">
            <div
              className={`text-xl font-medium ${
                theme === "black" ? "text-foreground" : "text-restro-green-dark"
              }`}
            >
              {t("superadmin_login.login")}
            </div>
            <div>
              <img src={(theme === "black" ? LogoDark : Logo)?.src || (theme === "black" ? LogoDark : Logo)} className="h-16" />
            </div>
          </div>

          <form className="mt-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="text-restro-text">
                {t("superadmin_login.email_label")}
              </label>
              <input
                type="email"
                id="username"
                name="username"
                required
                placeholder={t("superadmin_login.email_placeholder")}
                className="mt-1 block w-full px-4 py-3 rounded-xl outline-none focus-visible:ring-1 bg-restro-gray text-restro-text focus-visible:ring-restro-ring"
              />
            </div>

            <div className="mt-4">
              <label htmlFor="password" className="text-restro-text">
                {t("superadmin_login.password_label")}
              </label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  required
                  placeholder={t("superadmin_login.password_placeholder")}
                  className="block w-full px-4 py-3 pr-12 rounded-xl outline-none focus-visible:ring-1 bg-restro-gray text-restro-text focus-visible:ring-restro-ring"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-restro-text opacity-60 hover:opacity-100 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="block w-full mt-6 text-white rounded-xl px-4 py-3 transition hover:scale-105 active:scale-95 hover:shadow-md outline-none focus-visible:ring-1 bg-restro-green focus-visible:ring-restro-ring hover:bg-restro-green-button-hover"
            >
              {t("superadmin_login.login_button")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
