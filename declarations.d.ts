import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    'data-slot'?: string;
    'data-variant'?: string;
    'data-size'?: string;
    'data-orientation'?: string;
    'data-sidebar'?: string;
    'data-state'?: string;
    'data-collapsible'?: string;
    'data-side'?: string;
    'data-mobile'?: string;
    'data-active'?: boolean | string;
    'data-content'?: boolean | string;
    'data-align'?: string;
    'data-spacing'?: number | string;
    dataSet?: Record<string, string | number | boolean | undefined>;
  }
  interface TextProps {
    'data-slot'?: string;
    'data-variant'?: string;
    'data-size'?: string;
    'data-sidebar'?: string;
    'data-state'?: string;
    'data-active'?: boolean | string;
    dataSet?: Record<string, string | number | boolean | undefined>;
  }
  interface PressableProps {
    'data-slot'?: string;
    'data-variant'?: string;
    'data-size'?: string;
    'data-sidebar'?: string;
    'data-state'?: string;
    'data-active'?: boolean | string;
    dataSet?: Record<string, string | number | boolean | undefined>;
  }
  interface TextInputProps {
    'data-slot'?: string;
    'data-sidebar'?: string;
    dataSet?: Record<string, string | number | boolean | undefined>;
  }
}
