import React, { useEffect, useRef, useState } from "react";
import Logo from "../assets/logo.svg";
import LogoDark from "../assets/LogoDark.svg"
import { toast } from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { SCOPES } from "../config/scopes";
import { signUp } from "../controllers/auth.controller";
import { validateEmail } from "../utils/emailValidator";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";

export default function RegistrationPage() {
  const { t } = useTranslation();
  const {theme} = useTheme();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const bizName = e.target.biz_name.value;
    const email = e.target.username.value;
    const password = e.target.password.value;

    if (!bizName) {
      toast.error(t("register.business_name_error"));
      return;
    }

    if (!email) {
      toast.error(t("register.email_error"));
      return;
    }

    if (!password) {
      toast.error(t("register.password_error"));
      return;
    }

    if (!validateEmail(email)) {
      toast.error(t("register.valid_email_error"));
      return;
    }

    try {
      toast.loading(t("register.loading_message"));

      const res = await signUp(bizName, email, password);
      toast.dismiss();
      if (res.status == 200) {
        toast.success(res.data.message);
        navigate("/login", {
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
      const message = error?.response?.data?.message || t("register.error_message");

      toast.dismiss();
      toast.error(message);
      return;
    }
  };

  return (
    <div className='relative overflow-x-hidden md:overflow-hidden bg-restro-green-light'> 
    <img
      src="/assets/circle_illustration.svg"
      alt="illustration"
      className='absolute w-96 lg:w-[1024px] h-96 lg:h-[1024px] lg:-bottom-96 lg:-right-52 -right-36 '
    />

    <div className="flex flex-col md:flex-row items-center justify-end md:justify-between gap-10 h-screen container mx-auto px-4 md:px-0 py-4 md:py-0 relative lg:px-12">
      <div className="lg:block hidden">
        <h3
          className='text-2xl lg:text-6xl font-black text-restro-green-dark dark:text-restro-green-dark-mode'
        >
          {t("register.signup_today")}
        </h3>
        <h3
          className='text-2xl lg:text-6xl font-black outline-text dark:text-green-600 text-restro-green-light'
        >
          {t("register.increase_productivity")}
        </h3>
      </div>

      <div className='border bg-white dark:bg-black border-restro-border-green rounded-2xl px-8 py-8 w-full sm:w-96 mx-8 sm:mx-0 shadow-2xl'>
        <div className="flex items-center justify-between">
          <div className='text-xl font-medium dark:text-green-100 text-restro-green-dark'>
            {t("register.title")}
          </div>
          <div>
            <img src={(theme === "black" ? LogoDark : Logo)?.src || (theme === "black" ? LogoDark : Logo)} className="h-16" />
          </div>
        </div>

        <form className="mt-6" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="biz_name"
              className={theme === 'black' ? 'text-gray-200' : ''}
            >
              {t("register.business_name_label")}
            </label>
            <input
              type="text"
              id="biz_name"
              name="biz_name"
              required
              placeholder={t("register.business_name_placeholder")}
              className = 'mt-1 block w-full px-4 py-3 rounded-xl outline-none focus-visible:ring-1 bg-restro-gray focus-visible:ring-restro-ring'
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor="username"
              className={theme === 'black' ? 'text-gray-200' : ''}
            >
              {t("register.email_label")}
            </label>
            <input
              type="email"
              id="username"
              name="username"
              required
              placeholder={t("register.email_placeholder")}
              className='mt-1 block w-full px-4 py-3 rounded-xl outline-none focus-visible:ring-1 bg-restro-gray focus-visible:ring-restro-ring'
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor="password"
              className={theme === 'black' ? 'text-gray-200' : ''}
            >
              {t("register.password_label")}
            </label>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                required
                placeholder={t("register.password_placeholder")}
                className='block w-full px-4 py-3 pr-12 rounded-xl outline-none focus-visible:ring-1 bg-restro-gray focus-visible:ring-restro-ring'
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
            className='block w-full mt-6 text-white rounded-xl px-4 py-3 transition hover:scale-105 active:scale-95 hover:shadow-md outline-none focus-visible:ring-1 bg-restro-green focus-visible:ring-restro-ring hover:bg-restro-green-button-hover'>
            {t("register.register_button")}
          </button>

          <div className="flex items-center gap-4 my-4">
            <div className={`flex-1 border-b ${theme === 'black' ? 'border-gray-600' : ''}`}></div>
            <p className={`text-sm ${theme === 'black' ? 'text-gray-300' : 'text-gray-400'}`}>
              {t("register.or")}
            </p>
            <div className={`flex-1 border-b ${theme === 'black' ? 'border-gray-600' : ''}`}></div>
          </div>

          <Link
            to="/login"
            className='block w-full text-center rounded-xl px-4 py-3 transition hover:scale-105 active:scale-95 hover:shadow-xl outline-none focus-visible:ring-1 bg-restro-gray hover:bg-restro-button-hover focus-visible:ring-restro-ring dark:focus-visible:ring-restro-ring-dark'
          >
            {t("register.signin_button")}
          </Link>
        </form>
      </div>
    </div>
    </div>

  );
}
