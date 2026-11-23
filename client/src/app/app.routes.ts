import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

// Every feature is lazy-loaded, so the initial bundle only contains the app shell.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'SkillSwap · Trade skills, not money',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'login',
    title: 'Log in · SkillSwap',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'register',
    title: 'Sign up · SkillSwap',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register').then((m) => m.Register),
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: 'matches',
        title: 'Matches · SkillSwap',
        loadComponent: () => import('./features/matches/matches').then((m) => m.Matches),
      },
      {
        path: 'explore',
        title: 'Explore · SkillSwap',
        loadComponent: () => import('./features/explore/explore').then((m) => m.Explore),
      },
      {
        path: 'users/:id',
        title: 'Profile · SkillSwap',
        loadComponent: () => import('./features/profile/profile-view').then((m) => m.ProfileView),
      },
      {
        path: 'profile/edit',
        title: 'Edit profile · SkillSwap',
        loadComponent: () => import('./features/profile/profile-edit').then((m) => m.ProfileEdit),
      },
      {
        path: 'requests',
        title: 'Requests · SkillSwap',
        loadComponent: () => import('./features/requests/requests').then((m) => m.Requests),
      },
      {
        path: 'messages',
        title: 'Messages · SkillSwap',
        loadComponent: () => import('./features/chat/messages').then((m) => m.Messages),
      },
      {
        path: 'messages/:id',
        title: 'Messages · SkillSwap',
        loadComponent: () => import('./features/chat/messages').then((m) => m.Messages),
      },
    ],
  },
  {
    path: '**',
    title: 'Not found · SkillSwap',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
