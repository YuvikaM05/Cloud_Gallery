import { createBrowserRouter, createHashRouter } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Gallery from './pages/Gallery'
import Favorites from './pages/Favorites'
import Albums from './pages/Album'
import AlbumDetail from './pages/AlbumDetail'
import Shared from './pages/Shared'
import Bin from './pages/Bin'
import CloudStorage from './pages/CloudStorage'
import StorageAnalytics from './pages/StorageAnalytics'
import Settings from './pages/Settings'
import Login from './pages/Login'

// Electron loads the built app from file://, where only hash routing works.
const make = window.electronAPI ? createHashRouter : createBrowserRouter

export const router = make([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Gallery /> },
      { path: 'favorites', element: <Favorites /> },
      { path: 'albums', element: <Albums /> },
      { path: 'albums/:id', element: <AlbumDetail /> },
      { path: 'shared', element: <Shared /> },
      { path: 'bin', element: <Bin /> },
      { path: 'cloud-storage', element: <CloudStorage /> },
      { path: 'storage-analytics', element: <StorageAnalytics /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
])
