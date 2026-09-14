import styled from 'styled-components';

export const Button = styled.button`
  padding: ${({ theme }) => `${theme.space.sm} ${theme.space.lg}`};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surface};
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;
