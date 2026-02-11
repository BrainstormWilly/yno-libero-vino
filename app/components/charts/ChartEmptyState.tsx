import { type FC } from 'react';
import { Text } from '@shopify/polaris';

const DEFAULT_IMAGE_SRC = '/media/empty-wine-glass.svg';
const DEFAULT_MESSAGE = 'No data for this period';

interface ChartEmptyStateProps {
  /** Image to show when chart has no data. Defaults to empty wine glass. */
  imageSrc?: string;
  /** Optional short message below the image. */
  message?: string;
  /** Accessible label for the empty state (e.g. chart title + "no data"). */
  ariaLabel?: string;
}

const ChartEmptyState: FC<ChartEmptyStateProps> = ({
  imageSrc = DEFAULT_IMAGE_SRC,
  message = DEFAULT_MESSAGE,
  ariaLabel = 'Chart: no data',
}) => {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 300,
        gap: '0.75rem',
      }}
    >
      <img
        src={imageSrc}
        alt=""
        width={80}
        height={120}
        style={{ opacity: 0.6 }}
      />
      <Text variant="bodySm" tone="subdued" as="p">
        {message}
      </Text>
    </div>
  );
};

export default ChartEmptyState;
