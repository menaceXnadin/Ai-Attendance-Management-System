
import React from 'react';
import { Outlet } from 'react-router-dom';
import DashboardSidebar from '@/components/DashboardSidebar';

const DashboardLayout = () => {
  return (
    <DashboardSidebar>
      <Outlet />
    </DashboardSidebar>
  );
};

export default DashboardLayout;
