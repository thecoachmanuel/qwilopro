import React, { useContext, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  IconArmchair2,
  IconBuildingWarehouse,
  IconChartArea,
  IconChefHat,
  IconChevronLeft,
  IconChevronRight,
  IconDeviceIpadHorizontal,
  IconFileInvoice,
  IconFriends,
  IconLayoutDashboard,
  IconSettings2,
  IconStars,
  IconToolsKitchen3,
  IconUsersGroup,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import Logo from "../assets/logo.svg";
import LogoDark from "../assets/LogoDark.svg";
import AvatarImg from "../assets/avatar.svg";
import { iconStroke } from "../config/config";
import { getUserDetailsInLocalStorage } from "../helpers/UserDetails";
import { NavbarContext } from "../contexts/NavbarContext";
import { toggleNavbar } from "../helpers/NavbarSettings";
import { PLAN_FEATURES, SCOPES } from "../config/scopes";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";

export const getNavbarItems = (t) => [
  {
    type: "link",
    text: t("navbar.dashboard"),
    icon: <IconLayoutDashboard stroke={iconStroke} />,
    path: "/dashboard/home",
    scopes: [SCOPES.DASHBOARD],
    features: [PLAN_FEATURES.DASHBOARD],
  },
  {
    type: "link",
    text: t("navbar.pos"),
    icon: <IconDeviceIpadHorizontal stroke={iconStroke} />,
    path: "/dashboard/pos",
    scopes: [SCOPES.POS],
    features: [PLAN_FEATURES.POS],
  },
  {
    type: "link",
    text: t("navbar.orders"),
    icon: <IconToolsKitchen3 stroke={iconStroke} />,
    path: "/dashboard/orders",
    scopes: [
      SCOPES.POS,
      SCOPES.ORDERS,
      SCOPES.ORDER_STATUS,
      SCOPES.ORDER_STATUS_DISPLAY,
    ],
    features: [PLAN_FEATURES.POS],
  },
  {
    type: "link",
    text: t("navbar.kitchen"),
    icon: <IconChefHat stroke={iconStroke} />,
    path: "/dashboard/kitchen",
    scopes: [SCOPES.KITCHEN, SCOPES.KITCHEN_DISPLAY],
    features: [PLAN_FEATURES.KITCHEN],
  },
  {
    type: "text",
    text: t("navbar.offerings"),
  },
  {
    type: "link",
    text: t("navbar.reservation"),
    icon: <IconArmchair2 stroke={iconStroke} />,
    path: "/dashboard/reservation",
    scopes: [
      SCOPES.RESERVATIONS,
      SCOPES.VIEW_RESERVATIONS,
      SCOPES.MANAGE_RESERVATIONS,
    ],
    features: [PLAN_FEATURES.RESERVATIONS],
  },
  {
    type: "link",
    text: t("navbar.customers"),
    icon: <IconFriends stroke={iconStroke} />,
    path: "/dashboard/customers",
    scopes: [
      SCOPES.CUSTOMERS,
      SCOPES.VIEW_CUSTOMERS,
      SCOPES.MANAGE_CUSTOMERS,
    ],
    features: [PLAN_FEATURES.CUSTOMERS],
  },
  {
    type: "link",
    text: t("navbar.invoices"),
    icon: <IconFileInvoice stroke={iconStroke} />,
    path: "/dashboard/invoices",
    scopes: [SCOPES.INVOICES],
    features: [PLAN_FEATURES.INVOICES],
  },
  {
    type: "link",
    text: "Inventory",
    icon: <IconBuildingWarehouse stroke={iconStroke} />,
    path: "/dashboard/inventory",
    scopes: [SCOPES.INVENTORY],
    features: [PLAN_FEATURES.INVENTORY],
  },
  {
    type: "text",
    text: t("navbar.back_office"),
  },
  {
    type: "link",
    text: t("navbar.feedbacks"),
    icon: <IconStars stroke={iconStroke} />,
    path: "/dashboard/feedbacks",
    scopes: [SCOPES.FEEDBACK],
    features: [PLAN_FEATURES.FEEDBACK],
  },
  {
    type: "link",
    text: t("navbar.users"),
    icon: <IconUsersGroup stroke={iconStroke} />,
    path: "/dashboard/users",
    scopes: [],
    features: [PLAN_FEATURES.USER],
  },
  {
    type: "link",
    text: t("navbar.reports"),
    icon: <IconChartArea stroke={iconStroke} />,
    path: "/dashboard/reports",
    scopes: [SCOPES.REPORTS],
    features: [PLAN_FEATURES.REPORTS],
  },
  {
    type: "link",
    text: t("navbar.settings"),
    icon: <IconSettings2 stroke={iconStroke} />,
    path: "/dashboard/settings",
    scopes: [SCOPES.SETTINGS],
    features: [PLAN_FEATURES.SETTINGS],
  },
];

export default function Navbar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [user, setUser] = useState(() => getUserDetailsInLocalStorage() || {});

  useEffect(() => {
    const handleUpdate = () => {
      setUser(getUserDetailsInLocalStorage() || {});
    };
    window.addEventListener("restro_user_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("restro_user_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  useEffect(() => {
    setUser(getUserDetailsInLocalStorage() || {});
  }, [pathname]);

  const { role: userRole, scope } = user;
  const rawFeatures =
    user?.planFeatures || user?.planFeautures || user?.plan_features || user?.features;
  const userPlanFeatures = (
    Array.isArray(rawFeatures)
      ? rawFeatures
      : typeof rawFeatures === "string"
      ? (() => {
          try {
            const p = JSON.parse(rawFeatures);
            return Array.isArray(p) ? p : [rawFeatures];
          } catch {
            return rawFeatures.split(",");
          }
        })()
      : []
  ).map((s) => String(s).trim().toUpperCase());

  const userScopes = (scope || "")
    .split(",")
    .map((s) => s.trim().toUpperCase());

  const { theme } = useTheme();
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useContext(NavbarContext);

  const navbarItems = getNavbarItems(t);

  const filterItem = (item) => {
    const requiredFeatures = item.features || [];
    if (requiredFeatures.length > 0) {
      const hasPlan = requiredFeatures.some((f) =>
        userPlanFeatures.includes(String(f).trim().toUpperCase())
      );
      if (!hasPlan) return false;
    }

    if (item.type === "text") return true;

    if (item.type === "link") {
      if (userRole === "admin") return true;
      const requiredScopes = item.scopes || [];
      if (requiredScopes.length === 0) return true;
      return requiredScopes.some((sc) =>
        userScopes.includes(String(sc).trim().toUpperCase())
      );
    }
    return false;
  };

  const btnToggleNavbar = () => {
    const isNavCollapsed = toggleNavbar();
    console.log(isNavCollapsed);
    if (isNavCollapsed) {
      setIsNavbarCollapsed(true);
    } else {
      setIsNavbarCollapsed(false);
    }
  };

  if (isNavbarCollapsed) {
    return (
      <div className="flex flex-col items-start gap-4 h-screen px-5 py-6 overflow-y-auto fixed left-0 top-0 bg-restro-green-light">

        <img src={(theme === "black" ? LogoDark : Logo)?.src || (theme === "black" ? LogoDark : Logo)} alt="logo" className="w-12 block mb-6" />
        {navbarItems.filter(filterItem).map((item, index) => {
          if (item.type == "text") {
            return;
          }

          return (
            <Link
              key={index}
              className={clsx(
                `w-12 h-12 flex items-center justify-center rounded-full transition`,
                {
                  "bg-restro-bg-hover-dark-mode font-medium text-white": theme === 'black' && pathname.includes(item.path),
                  "bg-restro-border-green-light font-medium text-black": theme !== 'black' && pathname.includes(item.path),
                  "hover:bg-restro-bg-hover-dark-mode": theme === 'black' && !pathname.includes(item.path),
                  "hover:bg-restro-border-green-light": theme !== 'black' && !pathname.includes(item.path),
                }
              )}
              to={item.path}
            >
              {React.cloneElement(item.icon, {
                className: clsx(
                  "transition-colors text-current",
                  {
                    'text-white': theme === 'black' && pathname.includes(item.path),
                    'text-black': theme !== 'black' && pathname.includes(item.path),
                  }
                ),
              })}
            </Link>
          );
        })}

        <button
          onClick={btnToggleNavbar}
          className="w-12 h-12 flex items-center justify-center rounded-full transitionborder border-restro-green-light hover:bg-restro-border-green text-restro-text"
        >
          <IconChevronRight stroke={iconStroke} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-screen">
      <div className="flex flex-col items-start gap-2 md:w-72  md:gap-3 h-screen px-5 py-6 overflow-y-auto fixed left-0 top-0 bg-restro-green-light">
        <img src={(theme === 'black' ? LogoDark : Logo)?.src || (theme === 'black' ? LogoDark : Logo)} alt="logo" className="block w-12 md:w-auto md:h-14 mb-2 md:mb-6" />

        <div className="hidden md:flex items-center gap-2 w-full md:mb-6">
          <img
            src={AvatarImg?.src || AvatarImg}
            alt="avatar"
            className="md:w-12 md:h-12 rounded-full block"
          />
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-xs text-gray-500">
              {new String(user.role).toUpperCase()}
              {user.designation && <span>, {user.designation}</span>}
            </p>
          </div>
        </div>

        {
          navbarItems.filter(filterItem).map((item, index) => {
            if (item.type == "text") {
              return (
                <p key={index} className="font-bold hidden md:block">
                  {item.text}
                </p>
              );
            }

            return (

              <Link
                key={index}
                to={item.path}
                className={clsx(
                  `w-12 h-12 md:w-full flex justify-center md:justify-normal items-center md:gap-1 md:px-4 md:py-3 rounded-full transition group`,
                  {
                    'bg-restro-border-green-light font-medium': theme !== 'black' && pathname.includes(item.path),
                    'bg-restro-bg-hover-dark-mode font-medium text-white': theme === 'black' && pathname.includes(item.path),
                    'hover:bg-restro-bg-hover-dark-mode hover:text-white': theme === 'black' && !pathname.includes(item.path),
                    'hover:bg-restro-border-green-light': theme !== 'black' && !pathname.includes(item.path),
                    'text-white': theme === 'black' && !pathname.includes(item.path),
                    'text-black': theme === 'black' && pathname.includes(item.path),
                    'text-restro-text-light-mode hover:text-black': theme !== 'black',
                  }
                )}
              >
                {React.cloneElement(item.icon, {
                  className: clsx(
                    'transition-colors',
                    {
                      'text-white group-hover:text-white hover:text-white': theme === 'black',
                      'text-black': theme !== 'black',
                    }
                  ),
                })}
                <p
                  className={clsx(
                    'hidden md:block transition-colors',
                    {
                      'text-white group-hover:text-white hover:text-white': theme === 'black',
                      'text-gray-900 group-hover:text-black': theme !== 'black',
                      'text-black': theme !== 'black' && pathname.includes(item.path),
                    }
                  )}
                >
                  {item.text}
                </p>
              </Link>

            );
          })}
      </div>

      <button
        onClick={btnToggleNavbar}
        className="w-9 h-9 hidden md:flex items-center justify-center rounded-full border transition bg-restro-green-light border-restro-border-green dark:bg-restro-gray hover:bg-gray-100 dark:hover:bg-restro-button-hover text-gray-500 fixed bottom-4 left-[17.5rem] -translate-x-1/2"
      >
        <IconChevronLeft stroke={iconStroke} size={18} />
      </button>
    </div>
  );
}
