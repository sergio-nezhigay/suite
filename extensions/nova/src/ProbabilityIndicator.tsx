import { Text, InlineStack } from '@shopify/ui-extensions-react/admin';

type ProbabilityIndicatorProps = {
  probability: number;
};

const ProbabilityIndicator: React.FC<ProbabilityIndicatorProps> = ({
  probability,
}) => {
  const totalLength = 10;
  const filledLength = Math.round((probability / 100) * totalLength);

  const filler =
    '-'.repeat(filledLength) + '?'.repeat(totalLength - filledLength);

  return (
    <InlineStack gap inlineAlignment='space-between'>
      <Text fontWeight='bold' fontVariant='numeric'>
        Probability: {probability}%
      </Text>
      <Text>{filler}</Text>
    </InlineStack>
  );
};

export default ProbabilityIndicator;
