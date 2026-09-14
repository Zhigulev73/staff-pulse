import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { ThemeProvider } from 'styled-components';
import { queryClient } from '@/shared/api/queryClient';
import { GlobalStyle } from '@/shared/theme/GlobalStyle';
import { theme } from '@/shared/theme/theme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
