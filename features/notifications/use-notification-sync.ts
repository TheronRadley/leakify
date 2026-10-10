/**
 * Watches the data store and keeps OS-level local notifications in sync.
 * Debounced so a burst of edits converges to exactly one sync.
 */
import {
  getPermissionStatus,
  syncNotificationSchedule,
} from '@/features/notifications/service';
import { getDataState, useDataStore, useRepository } from '@/features/subscriptions/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageKeys } from '@/services/local-storage';
import * as React from 'react';
import { AppState, Platform } from 'react-native';

export function useNotificationSync() {
  const { status, subscriptions, notificationSettings } = useDataStore();
  const repos = useRepository();
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSync = React.useCallback(() => {
    if (Platform.OS === 'web') return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const state = getDataState();
      void syncNotificationSchedule(
        state.subscriptions,
        state.notificationSettings,
        repos.scheduledNotifications,
      );
    }, 800);
  }, [repos]);

  // Sync whenever the underlying data changes (create/update/delete/status).
  React.useEffect(() => {
    if (status !== 'ready') return;
    runSync();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [status, subscriptions, notificationSettings, runSync]);

  // Re-sync when the app returns to the foreground (dates may have rolled).
  React.useEffect(() => {
    if (status !== 'ready' || Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runSync();
    });
    return () => sub.remove();
  }, [status, runSync]);

  // Re-check permission once per app session and persist the observation.
  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    void getPermissionStatus().then((perm) => {
      const mapped = perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'unknown';
      const state = getDataState();
      if (state.notificationSettings.permissionStatus !== mapped && state.status === 'ready') {
        void AsyncStorage.mergeItem(
          storageKeys.notificationSettings(state.scope ?? 'local-user'),
          JSON.stringify({ permissionStatus: mapped }),
        );
      }
    });
  }, []);
}
