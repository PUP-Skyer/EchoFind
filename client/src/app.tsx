import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';

import { SettingsProvider } from './hooks/useSettings';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import Dashboard from './pages/Dashboard';
import DataFlow from './pages/DataFlow';
import Items from './pages/Items';
import Devices from './pages/Devices';
import Alerts from './pages/Alerts';
import Statistics from './pages/Statistics';
import Settings from './pages/Settings';
import UserProfile from './pages/UserProfile';
import PetParadise from './pages/PetParadise';
import FindGuide from './pages/FindGuide';
import Schedule from './pages/Schedule';
import BleControl from './pages/BleControl';

const RoutesComponent = () => {
  return (
    <SettingsProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="dataflow" element={<DataFlow />} />
          <Route path="items" element={<Items />} />
          <Route path="devices" element={<Devices />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="ble-control" element={<BleControl />} />
          <Route path="profile" element={<UserProfile />} />
          <Route path="pet-paradise" element={<PetParadise />} />
        </Route>
        <Route path="*" element={<NotFound />} />
        <Route path="find/:itemId" element={<FindGuide />} />
      </Routes>
    </SettingsProvider>
  );
};

export default RoutesComponent;
