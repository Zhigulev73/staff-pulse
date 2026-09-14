import styled from 'styled-components';
import { performanceColor } from '@/shared/theme/theme';

const Dot = styled.span<{ $value: number }>`
  display: inline-block;
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
  background: ${({ theme, $value }) => performanceColor(theme.colors, $value)};
  box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.surface};
`;

const Wrapper = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.xs};
  min-width: 44px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textMuted};
`;

interface PerformanceDotProps {
  value: number;
  /** Показывать ли число рядом с индикатором. */
  withValue?: boolean;
}

/** Цветовой индикатор эффективности: <50 красный, 50–74 жёлтый, ≥75 зелёный. */
export function PerformanceDot({ value, withValue = true }: PerformanceDotProps) {
  const rounded = Math.round(value);
  return (
    <Wrapper title={`Эффективность: ${rounded}`}>
      <Dot $value={value} role="img" aria-label={`Эффективность ${rounded} из 100`} />
      {withValue && <span aria-hidden="true">{rounded}</span>}
    </Wrapper>
  );
}
