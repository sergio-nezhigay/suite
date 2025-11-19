// React import not needed for functional components in modern React
import {
  BlockStack,
  InlineStack,
  Text,
  Button,
  Divider,
} from '@shopify/ui-extensions-react/admin';
import type { DeclarationCardProps } from '../types';

/**
 * Declaration Card Component
 *
 * Displays existing declaration information in a card format
 * - Declaration number (tracking number)
 * - Estimated delivery date
 * - Cost
 * - Recipient and warehouse info
 * - Optional: View/Download label buttons
 *
 * @example
 * <DeclarationCard
 *   declaration={declaration}
 *   onViewLabel={(ref) => window.open(...)}
 * />
 */
export default function DeclarationCard({
  declaration,
  onViewLabel,
  onDownloadLabel,
}: DeclarationCardProps) {
  return (
    <BlockStack
      padding="base"
    >
      {/* Declaration Number - Most Important */}
      <InlineStack blockAlignment="center" inlineAlignment="space-between">
        <Text fontWeight="bold">Номер декларації:</Text>
        <Text>{declaration.declarationNumber}</Text>
      </InlineStack>

      <Divider />

      {/* Estimated Delivery Date */}
      {declaration.estimatedDeliveryDate && (
        <InlineStack blockAlignment="center" inlineAlignment="space-between">
          <Text>Очікувана дата доставки:</Text>
          <Text>{declaration.estimatedDeliveryDate}</Text>
        </InlineStack>
      )}

      {/* Cost */}
      {declaration.cost && (
        <InlineStack blockAlignment="center" inlineAlignment="space-between">
          <Text>Вартість доставки:</Text>
          <Text>{declaration.cost} ₴</Text>
        </InlineStack>
      )}

      {/* Recipient Name */}
      {declaration.recipientName && (
        <InlineStack blockAlignment="center" inlineAlignment="space-between">
          <Text>Одержувач:</Text>
          <Text>{declaration.recipientName}</Text>
        </InlineStack>
      )}

      {/* Warehouse */}
      {declaration.warehouseDescription && (
        <BlockStack>
          <Text fontWeight="bold">Адреса доставки:</Text>
          <Text>
            {declaration.cityDescription && `${declaration.cityDescription}, `}
            {declaration.warehouseDescription}
          </Text>
        </BlockStack>
      )}

      {/* Created At */}
      {declaration.createdAt && (
        <InlineStack blockAlignment="center" inlineAlignment="space-between">
          <Text>
            Створено:
          </Text>
          <Text>
            {new Date(declaration.createdAt).toLocaleString('uk-UA')}
          </Text>
        </InlineStack>
      )}

      {/* Action Buttons */}
      {(onViewLabel || onDownloadLabel) && (
        <>
          <Divider />
          <InlineStack>
            {onViewLabel && declaration.printedFormUrl && (
              <Button
                onPress={() => onViewLabel(declaration.declarationRef)}
              >
                Переглянути етикетку
              </Button>
            )}
            {onDownloadLabel && declaration.printedFormUrl && (
              <Button
                onPress={() => onDownloadLabel(declaration.declarationRef)}
              >
                Завантажити етикетку
              </Button>
            )}
          </InlineStack>
        </>
      )}
    </BlockStack>
  );
}
