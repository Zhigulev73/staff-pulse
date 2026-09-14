import styled, { keyframes } from 'styled-components';
import { Button } from '@/shared/ui/Button';

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space.md};
  padding: 48px ${({ theme }) => theme.space.xl};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Spinner = styled.div`
  width: 28px;
  height: 28px;
  border: 3px solid ${({ theme }) => theme.colors.border};
  border-top-color: ${({ theme }) => theme.colors.accent};
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const ErrorText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.danger};
`;

const Details = styled.p`
  margin: 0;
  max-width: 640px;
  font-size: ${({ theme }) => theme.font.small};
  color: ${({ theme }) => theme.colors.textMuted};
  word-break: break-word;
`;

export function LoadingState() {
  return (
    <Panel role="status" aria-live="polite">
      <Spinner aria-hidden="true" />
      <span>Загружаем орг-структуру…</span>
    </Panel>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const details = error instanceof Error ? error.message : String(error);
  return (
    <Panel role="alert">
      <ErrorText>Не удалось загрузить данные</ErrorText>
      <Details>{details}</Details>
      <Button type="button" onClick={onRetry}>
        Повторить
      </Button>
    </Panel>
  );
}

export function EmptyState() {
  return (
    <Panel role="status">
      <span>Сервер вернул пустую орг-структуру — показывать нечего.</span>
    </Panel>
  );
}
