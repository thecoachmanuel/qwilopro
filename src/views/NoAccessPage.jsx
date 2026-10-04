import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Page from "../components/Page";
import Logo from "../assets/logo.svg";
import LogoDark from "../assets/LogoDark.svg"
import { IconChevronLeft, IconRefresh, IconLayoutDashboard } from '@tabler/icons-react';
import { iconStroke } from '../config/config';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import apiClient from '../helpers/ApiClient';
import { getUserDetailsInLocalStorage, saveUserDetailsInLocalStorage } from '../helpers/UserDetails';
import { toast } from 'react-hot-toast';

export default function NoAccessPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [isChecking, setIsChecking] = useState(false);

  // Automatically check if SuperAdmin updated plan and redirect to dashboard
  useEffect(() => {
    const user = getUserDetailsInLocalStorage();
    if (!user) return;

    if (typeof navigator !== "undefined" && navigator.onLine) {
      apiClient.post('/auth/refresh-token')
        .then((res) => {
          const freshUser = res.data?.userDetails;
          if (freshUser) {
            saveUserDetailsInLocalStorage(freshUser);
            if (Number(freshUser.is_active) === 1) {
              navigate('/dashboard/home', { replace: true });
            }
          }
        })
        .catch(() => {});
    }
  }, [navigate]);

  const handleRefreshPermissions = async () => {
    setIsChecking(true);
    try {
      const res = await apiClient.post('/auth/refresh-token');
      const freshUser = res.data?.userDetails;
      if (freshUser) {
        saveUserDetailsInLocalStorage(freshUser);
        toast.success("Plan permissions refreshed!");
        navigate('/dashboard/home', { replace: true });
        return;
      }
    } catch (e) {
      toast.error("Could not sync permissions. Please try again or contact support.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Page className='px-4 py-3 flex flex-col items-center justify-center w-full min-h-screen'>
      <img src={(theme === "black" ? LogoDark : Logo)?.src || (theme === "black" ? LogoDark : Logo)} alt="logo" className="h-14 block mb-6" />
      <h3 className="text-2xl font-bold text-center mb-2">{t('no_access.title') || "Access Restricted"}</h3>
      <p className="text-sm text-slate-500 dark:text-neutral-400 text-center max-w-md mb-6">
        This feature is not part of your current active subscription plan. If your administrator just updated or upgraded your plan, click below to sync immediately.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={handleRefreshPermissions}
          disabled={isChecking}
          className='btn btn-sm px-4 py-2 bg-restro-green text-white hover:bg-restro-green-dark border-none rounded-xl font-medium shadow flex items-center gap-2'
        >
          <IconRefresh className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} stroke={iconStroke} />
          {isChecking ? "Checking Plan..." : "Sync Updated Plan"}
        </button>

        <button
          onClick={() => navigate('/dashboard/home')}
          className='btn btn-sm px-4 py-2 bg-gray-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 hover:bg-gray-200 border-none rounded-xl font-medium flex items-center gap-2'
        >
          <IconLayoutDashboard className='w-4 h-4' stroke={iconStroke} />
          Go to Dashboard
        </button>
      </div>
    </Page>
  );
}
