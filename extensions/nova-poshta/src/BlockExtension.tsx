import { useState, useEffect } from 'react';
import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
  Button,
  Banner,
  Divider,
  InlineStack,
} from '@shopify/ui-extensions-react/admin';

// Import shared utilities
import { getOrderInfo, saveDeclaration } from '../../shared/shopifyOperations';
import type { OrderInfo } from '../../shared/shopifyOperations';

// Import components
import CityAutocomplete from './components/CityAutocomplete';
import WarehouseAutocomplete from './components/WarehouseAutocomplete';
import DeclarationCard from './components/DeclarationCard';

// Import hooks
import { useCreateDeclaration } from './hooks/useNovaPoshtaApi';

// Import types
import type { PackageDetails, Declaration } from './types';

// Import constants
import { DEFAULT_PACKAGE_DETAILS } from './constants';

// Import utilities
import { calculateUnfulfilledItemsCost } from './utils/orderUtils';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const { data } = useApi(TARGET);
  const orderId = data.selected[0]?.id;

  // State for order data
  const [orderInfo, setOrderInfo] = useState<OrderInfo>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [orderError, setOrderError] = useState<string | null>(null);

  // State for form visibility
  const [showForm, setShowForm] = useState(false);

  // State for city/warehouse selection
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [selectedCityRef, setSelectedCityRef] = useState<string | null>(null);
  const [selectedCityDescription, setSelectedCityDescription] =
    useState<string>('');
  const [selectedWarehouseRef, setSelectedWarehouseRef] = useState<
    string | null
  >(null);
  const [selectedWarehouseDescription, setSelectedWarehouseDescription] =
    useState<string>('');

  // Package details - calculate cost from unfulfilled line items
  const calculatedCost = calculateUnfulfilledItemsCost(
    orderInfo?.orderDetails?.lineItems
  );
  const packageDetails: PackageDetails = {
    weight: DEFAULT_PACKAGE_DETAILS.WEIGHT,
    cost: calculatedCost,
    seatsAmount: DEFAULT_PACKAGE_DETAILS.SEATS_AMOUNT,
    description: DEFAULT_PACKAGE_DETAILS.DESCRIPTION,
    cargoType: DEFAULT_PACKAGE_DETAILS.CARGO_TYPE,
    paymentMethod: DEFAULT_PACKAGE_DETAILS.PAYMENT_METHOD,
    serviceType: DEFAULT_PACKAGE_DETAILS.SERVICE_TYPE,
  };

  // State for declarations list
  const [declarations, setDeclarations] = useState<Declaration[]>([]);

  // State for success message
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Hook for declaration creation
  const {
    createDeclaration,
    isLoading: isCreating,
    error: createError,
  } = useCreateDeclaration();

  // ============================================
  // Effect: Fetch Order Data on Mount
  // ============================================
  useEffect(() => {
    if (!orderId) {
      setOrderError('Не вдалося отримати ID замовлення');
      setIsLoadingOrder(false);
      return;
    }

    const fetchOrderData = async () => {
      try {
        setIsLoadingOrder(true);
        setOrderError(null);

        const info = await getOrderInfo(orderId);
        setOrderInfo(info);

        // Pre-fill city search with shipping address city
        if (info?.orderDetails?.city) {
          setCitySearchQuery(info.orderDetails.city);
        }

        // Load existing declarations
        if (info?.novaposhtaDeclaration?.number && info?.orderDetails) {
          // We have at least one declaration
          const existingDeclaration: Declaration = {
            declarationRef: info.novaposhtaDeclaration.ref || '',
            declarationNumber: info.novaposhtaDeclaration.number,
            estimatedDeliveryDate: '',
            cost: '',
            recipientName: `${info.orderDetails.firstName} ${info.orderDetails.lastName}`,
            warehouseDescription:
              info.novaposhtaRecepientWarehouse?.warehouseDescription,
            cityDescription: info.novaposhtaRecepientWarehouse?.cityDescription,
          };
          setDeclarations([existingDeclaration]);
        }

        setIsLoadingOrder(false);
      } catch (err) {
        console.error('Failed to fetch order info:', err);
        setOrderError(
          err instanceof Error ? err.message : 'Помилка завантаження замовлення'
        );
        setIsLoadingOrder(false);
      }
    };

    fetchOrderData();
  }, [orderId]);

  // ============================================
  // Handler: Create Declaration
  // ============================================
  const handleCreateDeclaration = async () => {
    if (!orderInfo?.orderDetails || !selectedCityRef || !selectedWarehouseRef) {
      return;
    }

    setSuccessMessage(null);

    const { firstName, lastName, shippingPhone, email, paymentMethod } =
      orderInfo.orderDetails;

    // Validate phone number
    if (!shippingPhone) {
      alert('Номер телефону відсутній у замовленні');
      return;
    }

    try {
      const declaration = await createDeclaration({
        firstName,
        lastName,
        phone: shippingPhone,
        email: email || undefined,
        recipientCityRef: selectedCityRef,
        recipientWarehouseRef: selectedWarehouseRef,
        weight: packageDetails.weight,
        cost: packageDetails.cost,
        seatsAmount: packageDetails.seatsAmount,
        description: packageDetails.description,
        cargoType: packageDetails.cargoType,
        paymentMethod: paymentMethod || packageDetails.paymentMethod,
        serviceType: packageDetails.serviceType,
      });

      if (declaration) {
        // Save to metafields
        await saveDeclaration({
          orderId,
          declaration: {
            declarationRef: declaration.declarationRef,
            declarationNumber: declaration.declarationNumber,
            estimatedDeliveryDate: declaration.estimatedDeliveryDate,
            cost: declaration.cost,
            recipientName: `${firstName} ${lastName}`,
            cityRef: selectedCityRef,
            cityDescription: selectedCityDescription,
            warehouseRef: selectedWarehouseRef,
            warehouseDescription: selectedWarehouseDescription,
            createdAt: new Date().toISOString(),
          },
        });

        // Add to declarations list
        setDeclarations((prev) => [
          ...prev,
          {
            ...declaration,
            recipientName: `${firstName} ${lastName}`,
            warehouseDescription: selectedWarehouseDescription,
            cityDescription: selectedCityDescription,
            createdAt: new Date().toISOString(),
          },
        ]);

        // Show success message
        setSuccessMessage(
          `✅ Декларація створена: ${declaration.declarationNumber}`
        );

        // Reset form
        setShowForm(false);
        setCitySearchQuery('');
        setSelectedCityRef(null);
        setSelectedWarehouseRef(null);

        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      console.error('Failed to create declaration:', err);
    }
  };

  // ============================================
  // Handler: View Label
  // ============================================
  const handleViewLabel = (declarationRef: string) => {
    const declaration = declarations.find(
      (d) => d.declarationRef === declarationRef
    );
    if (declaration?.printedFormUrl) {
      window.open(declaration.printedFormUrl, '_blank');
    }
  };

  // ============================================
  // Render: Loading State
  // ============================================
  if (isLoadingOrder) {
    return (
      <AdminBlock title='Нова Пошта - Декларації'>
        <BlockStack>
          <Text>Завантаження інформації про замовлення...</Text>
        </BlockStack>
      </AdminBlock>
    );
  }

  // ============================================
  // Render: Error State
  // ============================================
  if (orderError || !orderInfo) {
    return (
      <AdminBlock title='Нова Пошта - Декларації'>
        <Banner tone='critical'>
          {orderError || 'Не вдалося завантажити дані замовлення'}
        </Banner>
      </AdminBlock>
    );
  }

  // ============================================
  // Render: Main UI
  // ============================================
  const { orderDetails } = orderInfo;
  const canCreateDeclaration =
    selectedCityRef &&
    selectedWarehouseRef &&
    parseFloat(packageDetails.weight) > 0 &&
    parseFloat(packageDetails.cost) > 0;

  return (
    <AdminBlock title='Нова Пошта - Створення Декларації'>
      <BlockStack>
        {/* Success Message */}
        {successMessage && <Banner tone='success'>{successMessage}</Banner>}

        {/* Error Message */}
        {createError && <Banner tone='critical'>{createError}</Banner>}

        {/* Shipping Address Section */}
        {orderDetails && (
          <BlockStack>
            <Text>
              {orderDetails.firstName} {orderDetails.lastName}
            </Text>
            {orderDetails.shippingPhone && (
              <Text>Телефон: {orderDetails.shippingPhone}</Text>
            )}
            {orderDetails.city && <Text>Місто: {orderDetails.city}</Text>}
            {orderDetails.address && (
              <Text>Адреса: {orderDetails.address}</Text>
            )}
            {orderDetails.paymentMethod && (
              <Text>
                {orderDetails.paymentMethod} - {calculatedCost} ₴
              </Text>
            )}
          </BlockStack>
        )}

        <Divider />

        {/* Existing Declarations Section */}
        {declarations.length > 0 && (
          <BlockStack>
            <Text fontWeight='bold'>
              Існуючі декларації ({declarations.length}):
            </Text>
            {declarations.map((declaration, index) => (
              <DeclarationCard
                key={declaration.declarationRef || index}
                declaration={declaration}
                onViewLabel={handleViewLabel}
              />
            ))}
          </BlockStack>
        )}

        {declarations.length > 0 && <Divider />}

        {/* Create New Declaration Section */}
        {!showForm ? (
          <Button onPress={() => setShowForm(true)}>
            Створити нову декларацію
          </Button>
        ) : (
          <BlockStack>
            <Text fontWeight='bold'>Нова декларація</Text>

            {/* City Autocomplete */}
            <CityAutocomplete
              label='Місто отримувача'
              value={citySearchQuery}
              onChange={setCitySearchQuery}
              onCitySelect={(ref, description) => {
                setSelectedCityRef(ref);
                setSelectedCityDescription(description);
                setSelectedWarehouseRef(null); // Reset warehouse when city changes
              }}
              disabled={isCreating}
            />

            {/* Warehouse Autocomplete */}
            {selectedCityRef && (
              <WarehouseAutocomplete
                label='Відділення Нової Пошти'
                cityRef={selectedCityRef}
                selectedWarehouseRef={selectedWarehouseRef}
                onWarehouseSelect={(ref, description) => {
                  setSelectedWarehouseRef(ref);
                  setSelectedWarehouseDescription(description);
                }}
                disabled={isCreating}
              />
            )}

            {/* Action Buttons */}
            <InlineStack>
              <Button
                onPress={handleCreateDeclaration}
                disabled={!canCreateDeclaration || isCreating}
              >
                {isCreating ? 'Створення...' : 'Створити декларацію'}
              </Button>
              <Button
                onPress={() => {
                  setShowForm(false);
                  setCitySearchQuery('');
                  setSelectedCityRef(null);
                  setSelectedWarehouseRef(null);
                }}
                disabled={isCreating}
              >
                Скасувати
              </Button>
            </InlineStack>
          </BlockStack>
        )}
      </BlockStack>
    </AdminBlock>
  );
}
