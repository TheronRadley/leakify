import { useWindowDimensions } from 'react-native';

const MOBILE_BREAKPOINT = 768;

/**
 * Official shadcn/ui `useIsMobile` hook (`hooks/use-mobile.ts`) adapted for
 * universal Expo / React Native + Web (`MOBILE_BREAKPOINT = 768`).
 */
export function useIsMobile(): boolean {
  const { width } = useWindowDimensions();
  return width > 0 ? width < MOBILE_BREAKPOINT : false;
}
