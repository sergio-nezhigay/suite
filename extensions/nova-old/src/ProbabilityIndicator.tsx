import { Text, InlineStack } from '@shopify/ui-extensions-react/admin';

type ProbabilityIndicatorProps = {
  probability: number;
};

const ProbabilityIndicator: React.FC<ProbabilityIndicatorProps> = ({
  probability,
}) => {
  if (probability === 100) return <Text>Адресу підтверджено</Text>;
  const totalLength = 10;
  const filledLength = Math.floor((probability / 100) * totalLength);

  const filler =
    '-'.repeat(filledLength) + '?'.repeat(totalLength - filledLength);

  return (
    <InlineStack gap inlineAlignment='space-between'>
      <Text fontWeight='bold' fontVariant='numeric'>
        Ймовірність : {probability}%
      </Text>
      <Text>{filler}</Text>
    </InlineStack>
  );
};

export default ProbabilityIndicator;
