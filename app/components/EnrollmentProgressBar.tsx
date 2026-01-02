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
    <Box padding="400" background="bg-surface-secondary" className="enrollment-progress-bar">
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
                  backgroundColor: isCompleted
                    ? '#008060' // success green
                    : isCurrent
                    ? '#6B7280' // gray-500 (not purple/indigo)
                    : '#E3E3E3', // subdued gray
                  color: isCompleted || isCurrent ? 'white' : '#616161',
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
                    backgroundColor: isCompleted ? '#008060' : '#E3E3E3',
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
  );
}

