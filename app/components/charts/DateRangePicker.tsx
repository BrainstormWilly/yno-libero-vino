import { type FC, useState, useCallback } from 'react';
import { Select, BlockStack, Text, DatePicker, Popover, Button } from '@shopify/polaris';

export type DateRangeOption = {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

interface DateRangePickerProps {
  value: string;
  onChange: (value: string, option: DateRangeOption) => void;
  options?: DateRangeOption[];
}

const DEFAULT_OPTIONS: DateRangeOption[] = [
  {
    label: 'Last 7 days',
    value: '7d',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  },
  {
    label: 'Last 30 days',
    value: '30d',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  },
  {
    label: 'Last 90 days',
    value: '90d',
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  },
  {
    label: 'Last year',
    value: '1y',
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  },
  {
    label: 'All time',
    value: 'all',
    startDate: new Date(0), // Beginning of time
    endDate: new Date(),
  },
  {
    label: 'Custom',
    value: 'custom',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  },
];

const DateRangePicker: FC<DateRangePickerProps> = ({ 
  value,
  onChange,
  options = DEFAULT_OPTIONS
}) => {
  const selectedOption = options.find(opt => opt.value === value) || options[1];
  const [popoverActive, setPopoverActive] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: selectedOption.startDate,
    end: selectedOption.endDate,
  });
  const [{ month, year }, setDate] = useState({
    month: selectedOption.endDate.getMonth(),
    year: selectedOption.endDate.getFullYear(),
  });

  const handleSelectChange = (selectedValue: string) => {
    if (selectedValue === 'custom') {
      // Keep current custom dates
      const customOption: DateRangeOption = {
        label: 'Custom',
        value: 'custom',
        startDate: dateRange.start,
        endDate: dateRange.end,
      };
      onChange('custom', customOption);
      setPopoverActive(true);
    } else {
      const option = options.find(opt => opt.value === selectedValue);
      if (option) {
        setDateRange({
          start: option.startDate,
          end: option.endDate,
        });
        setDate({
          month: option.endDate.getMonth(),
          year: option.endDate.getFullYear(),
        });
        onChange(selectedValue, option);
      }
    }
  };

  const handleDatePickerChange = useCallback((range: { start: Date; end: Date }) => {
    setDateRange(range);
    const customOption: DateRangeOption = {
      label: 'Custom',
      value: 'custom',
      startDate: range.start,
      endDate: range.end,
    };
    onChange('custom', customOption);
  }, [onChange]);

  const handleMonthChange = useCallback(
    (month: number, year: number) => setDate({ month, year }),
    []
  );

  const togglePopoverActive = useCallback(
    () => setPopoverActive((popoverActive) => !popoverActive),
    []
  );

  const isCustom = value === 'custom';
  const dateDisplay = isCustom
    ? `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
    : selectedOption.label;

  return (
    <BlockStack gap="300">
      <Text variant="bodyMd" as="p">
        <strong>Date Range:</strong>
      </Text>
      <Select
        label=""
        labelHidden
        options={options.map(opt => ({ label: opt.label, value: opt.value }))}
        value={value}
        onChange={handleSelectChange}
      />
      {isCustom && (
        <Popover
          active={popoverActive}
          activator={
            <Button onClick={togglePopoverActive} disclosure>
              {dateDisplay}
            </Button>
          }
          onClose={togglePopoverActive}
        >
          <DatePicker
            month={month}
            year={year}
            selected={dateRange}
            onChange={handleDatePickerChange}
            onMonthChange={handleMonthChange}
            allowRange
            multiMonth
          />
        </Popover>
      )}
    </BlockStack>
  );
};

export default DateRangePicker;
