import styled, { css, keyframes } from 'styled-components';
import { type LiveStatus, type LiveStatusInfo } from '@/shared/live/liveClient';
import { type AppTheme } from '@/shared/theme/theme';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
`;

const Wrapper = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 999px;
  font-size: ${({ theme }) => theme.font.small};
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.surface};
  white-space: nowrap;
`;

function dotColor(colors: AppTheme['colors'], status: LiveStatus): string {
  switch (status) {
    case 'live':
      return colors.perfHigh;
    case 'connecting':
      return colors.textMuted;
    case 'reconnecting':
      return colors.perfMid;
    case 'offline':
      return colors.perfLow;
  }
}

const Dot = styled.span<{ $status: LiveStatus }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ theme, $status }) => dotColor(theme.colors, $status)};
  ${({ $status }) =>
    $status !== 'live' &&
    css`
      animation: ${pulse} 1.4s ease-in-out infinite;
    `}
`;

function describeStatus(info: LiveStatusInfo): string {
  switch (info.status) {
    case 'live':
      return 'Live';
    case 'connecting':
      return 'Подключение…';
    case 'reconnecting':
      return info.retryInMs !== null
        ? `Переподключение через ${Math.max(1, Math.round(info.retryInMs / 1000))} с (попытка ${info.attempt})`
        : 'Переподключение…';
    case 'offline':
      return 'Нет сети';
  }
}

/** Индикатор состояния live-канала в шапке. */
export function ConnectionIndicator({ info }: { info: LiveStatusInfo }) {
  const text = describeStatus(info);
  return (
    <Wrapper role="status" aria-live="polite" title={`Live-обновления: ${text}`}>
      <Dot $status={info.status} aria-hidden="true" />
      {text}
    </Wrapper>
  );
}
