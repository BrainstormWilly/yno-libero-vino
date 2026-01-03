import { Box, InlineStack, Text, Icon } from '@shopify/polaris';
import { CheckIcon } from '@shopify/polaris-icons';
import { useNavigate } from 'react-router';
import { useCallback, useMemo } from 'react';

export interface ProgressStep {
  key: string;
  label: string;
  url: string;
  order: number;
}

export interface ProgressNavBarProps {
  steps: ProgressStep[];
  currentStepKey: string;
  completedStepKeys?: Set<string> | string[]; // Steps that are completed
  onStepClick?: (step: ProgressStep) => void; // Optional custom click handler
  className?: string;
}

export default function ProgressNavBar({
  steps,
  currentStepKey,
  completedStepKeys = [],
  onStepClick,
  className = '',
}: ProgressNavBarProps) {
  const navigate = useNavigate();
  
  // Normalize completedStepKeys to a Set for easier lookup
  const completedSet = useMemo(() => {
    return completedStepKeys instanceof Set 
      ? completedStepKeys 
      : new Set(completedStepKeys);
  }, [completedStepKeys]);
  
  // Sort steps by order
  const sortedSteps = useMemo(() => {
    return [...steps].sort((a, b) => a.order - b.order);
  }, [steps]);
  
  const handleStepClick = useCallback((step: ProgressStep) => {
    // Only allow clicking on completed or current steps
    const isCompleted = completedSet.has(step.key);
    const isCurrent = step.key === currentStepKey;
    
    if (!isCompleted && !isCurrent) {
      return; // Don't navigate to incomplete steps
    }
    
    if (onStepClick) {
      onStepClick(step);
    } else {
      navigate(step.url);
    }
  }, [completedSet, currentStepKey, navigate, onStepClick]);
  
  const getStepState = (step: ProgressStep) => {
    if (completedSet.has(step.key)) return 'completed';
    if (step.key === currentStepKey) return 'current';
    return 'upcoming';
  };
  
  return (
    <div className={`progress-nav-bar ${className}`}>
      <Box padding="400" background="bg-surface-secondary">
        <InlineStack gap="400" align="center" blockAlign="center">
          {sortedSteps.map((step, index) => {
            const state = getStepState(step);
            const isCompleted = state === 'completed';
            const isCurrent = state === 'current';
            const isClickable = isCompleted || isCurrent;
            
            return (
              <InlineStack key={step.key} gap="200" align="center" blockAlign="center">
                {/* Step Circle */}
                <div
                  className={`progress-nav-step-circle ${state}`}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    cursor: isClickable ? 'pointer' : 'not-allowed',
                  }}
                  onClick={() => handleStepClick(step)}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : -1}
                  onKeyDown={(e) => {
                    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleStepClick(step);
                    }
                  }}
                  aria-label={`${step.label} ${isCompleted ? 'completed' : isCurrent ? 'current' : 'locked'}`}
                  aria-disabled={!isClickable}
                >
                  {isCompleted ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon source={CheckIcon} />
                    </div>
                  ) : (
                    step.order
                  )}
                </div>
                
                {/* Step Label - make clickable if step is clickable */}
                {isClickable ? (
                  <button
                    onClick={() => handleStepClick(step)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    className="progress-nav-label-button"
                  >
                    <Text
                      as="span"
                      variant="bodyMd"
                      fontWeight={isCurrent ? 'semibold' : 'regular'}
                    >
                      {step.label}
                    </Text>
                  </button>
                ) : (
                  <Text
                    as="span"
                    variant="bodyMd"
                    fontWeight="regular"
                    tone="subdued"
                  >
                    {step.label}
                  </Text>
                )}
                
                {/* Connector Line */}
                {index < sortedSteps.length - 1 && (
                  <div
                    className={`progress-nav-connector ${isCompleted ? 'completed' : 'inactive'}`}
                    style={{
                      width: '40px',
                      height: '2px',
                      marginLeft: '8px',
                      marginRight: '8px',
                      transition: 'all 0.2s ease',
                    }}
                  />
                )}
              </InlineStack>
            );
          })}
        </InlineStack>
      </Box>
    </div>
  );
}

