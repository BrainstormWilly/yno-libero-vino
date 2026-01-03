import { Box, InlineStack, Text, Icon } from '@shopify/polaris';
import { CheckIcon } from '@shopify/polaris-icons';

type StepKey = 'qualify' | 'customer' | 'address' | 'payment' | 'review';

interface Step {
  key: StepKey;
  label: string;
  order: number;
}

interface EnrollmentProgressBarProps {
  currentStep: StepKey;
}

const STEPS: Step[] = [
  { key: 'qualify', label: 'Tier', order: 1 },
  { key: 'customer', label: 'Customer', order: 2 },
  { key: 'address', label: 'Address', order: 3 },
  { key: 'payment', label: 'Payment', order: 4 },
  { key: 'review', label: 'Review', order: 5 },
];

export default function EnrollmentProgressBar({ currentStep }: EnrollmentProgressBarProps) {
  const currentStepOrder = STEPS.find(s => s.key === currentStep)?.order || 1;
  
  return (
    <div className="enrollment-progress-bar">
      <Box padding="400" background="bg-surface-secondary">
        <InlineStack gap="400" align="center" blockAlign="center">
        {STEPS.map((step, index) => {
          const isCompleted = step.order < currentStepOrder;
          const isCurrent = step.key === currentStep;
          const isUpcoming = step.order > currentStepOrder;
          
          return (
            <InlineStack key={step.key} gap="200" align="center" blockAlign="center">
              {/* Step Circle */}
              <div
                className={`enrollment-step-circle ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
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
                }}
              >
                {isCompleted ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon source={CheckIcon} />
                  </div>
                ) : (
                  step.order
                )}
              </div>
              
              {/* Step Label */}
              <Text
                as="span"
                variant="bodyMd"
                fontWeight={isCurrent ? 'semibold' : 'regular'}
                tone={isUpcoming ? 'subdued' : undefined}
              >
                {step.label}
              </Text>
              
              {/* Connector Line */}
              {index < STEPS.length - 1 && (
                <div
                  className={`enrollment-connector ${isCompleted ? 'completed' : 'inactive'}`}
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

