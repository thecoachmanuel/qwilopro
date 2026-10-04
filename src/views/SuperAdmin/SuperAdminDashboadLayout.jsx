import React, { useContext } from 'react'
import { Outlet } from "react-router-dom"
import SuperAdminNavbar from '../../components/SuperAdminNavbar'
import SuperAdminMobileNavbar from '../../components/SuperAdminMobileNavbar'
import SuperAdminAppBar from '../../components/SuperAdminAppBar'
import { NavbarContext } from '../../contexts/NavbarContext'
import useAuth from '../../helpers/useAuth'

export default function SuperAdminDashboadLayout() {
  useAuth();
  const [isNavbarCollapsed] = useContext(NavbarContext)

  return (
   <div className='flex'>
      <SuperAdminNavbar />
      <div className={isNavbarCollapsed?`w-full ml-[5.5rem] md:ml-[5.5rem] overflow-y-auto h-screen pb-20 md:pb-0`:`w-full ml-0 md:ml-72 overflow-y-auto h-screen pb-20 md:pb-0`}>
        <SuperAdminAppBar />
        <Outlet />
      </div>
      <SuperAdminMobileNavbar />
    </div>
  )
}
