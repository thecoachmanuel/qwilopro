import React, { useContext } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import AppBar from "../components/AppBar";
import MobileNavbar from "../components/MobileNavbar";
import OfflineStatusBanner from "../components/OfflineStatusBanner";
import { NavbarContext } from "../contexts/NavbarContext";
import useAuth from "../helpers/useAuth";

export default function DashboardLayout() {
  useAuth();
  const [isNavbarCollapsed] = useContext(NavbarContext);
  const navigate = useNavigate();

  const contentPaddingClass = isNavbarCollapsed
    ? "w-full md:pl-[5.5rem]"
    : "w-full md:pl-72";

  return (
    <div className="flex min-h-screen">
      <div className="hidden md:block">
        <Navbar />
      </div>
      <div className={`${contentPaddingClass} pb-24 md:pb-0 flex flex-col min-h-screen`}>
        <OfflineStatusBanner />
        <AppBar />
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
      <MobileNavbar />
    </div>
  );
}
