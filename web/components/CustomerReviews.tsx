import React, { useState } from 'react';
import { Box, Text, Icon, HorizontalStack, VerticalStack } from '@shopify/polaris';
import { ChevronLeftIcon, ChevronRightIcon, StarFilledIcon } from '@shopify/polaris-icons';

interface Review {
  id: string;
  userName: string;
  avatar: string;
  rating: number;
  timeAgo: string;
  title: string;
  content: string;
  isVerified: boolean;
}

const mockReviews: Review[] = [
  {
    id: '1',
    userName: 'Clayton G.',
    avatar: '/avatars/clayton.jpg',
    rating: 5,
    timeAgo: '4 days ago',
    title: 'Would highly recommend!',
    content: 'Bought them to put in a college education lab classroom. It\'s been almost a year since we installed and they have done a great job handling the abuse of college students. People always comment how great the colors are, would highly recommend!',
    isVerified: true
  },
  {
    id: '2',
    userName: 'Emma S.',
    avatar: '/avatars/emma.jpg',
    rating: 5,
    timeAgo: '4 days ago',
    title: 'They look fantastic',
    content: 'The university where I work purchased two of the 9-hook coat rails with XL hooks for one of our biology labs. They look fantastic, and so far no issues with handling college students\' heavy backpacks - these are a great solution for a space where we did not have room to install cubbies or lockers!',
    isVerified: true
  },
  {
    id: '3',
    userName: 'Jim C.',
    avatar: '/avatars/jim.jpg',
    rating: 5,
    timeAgo: '4 days ago',
    title: 'A great addition to our children\'s entryway',
    content: 'These coat hooks have been a great addition to our children\'s entryway. Not only do they good great they are very durable over the year we have had them. We just purchased more for other areas. Calvary Community Church Lake Geneva Wisconsin',
    isVerified: true
  }
];

const StarRating: React.FC<{ rating: number }> = ({ rating }) => {
  return (
    <HorizontalStack gap="025">
      {[...Array(5)].map((_, index) => (
        <Icon
          key={index}
          source={StarFilledIcon}
          tone={index < rating ? 'warning' : 'subdued'}
        />
      ))}
    </HorizontalStack>
  );
};

const ReviewCard: React.FC<{ review: Review }> = ({ review }) => {
  return (
    <Box
      padding="600"
      background="bg-surface"
      borderRadius="200"
      borderWidth="025"
      borderColor="border-subdued"
      minHeight="300px"
    >
      <VerticalStack gap="400">
        <HorizontalStack gap="300" align="start">
          <Box
            borderRadius="round"
            background="bg-fill-tertiary"
            minWidth="48px"
            minHeight="48px"
            style={{
              width: '48px',
              height: '48px',
              backgroundImage: `url(${review.avatar})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          <VerticalStack gap="100">
            <StarRating rating={review.rating} />
            <Text variant="bodySm" tone="subdued">
              {review.timeAgo}
            </Text>
          </VerticalStack>
        </HorizontalStack>

        <VerticalStack gap="200">
          <HorizontalStack gap="200" align="start">
            <Text variant="bodyMd" fontWeight="semibold">
              {review.userName}
            </Text>
            {review.isVerified && (
              <Box
                padding="025"
                paddingInlineStart="200"
                paddingInlineEnd="200"
                background="bg-fill-success-secondary"
                borderRadius="100"
              >
                <Text variant="captionSm" tone="success">
                  Verified Customer
                </Text>
              </Box>
            )}
          </HorizontalStack>

          <Text variant="headingSm" fontWeight="semibold">
            {review.title}
          </Text>

          <Text variant="bodySm" tone="subdued">
            {review.content}
          </Text>
        </VerticalStack>
      </VerticalStack>
    </Box>
  );
};

const CustomerReviews: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextReview = () => {
    setCurrentIndex((prev) => (prev + 1) % mockReviews.length);
  };

  const prevReview = () => {
    setCurrentIndex((prev) => (prev - 1 + mockReviews.length) % mockReviews.length);
  };

  return (
    <Box padding="800" background="bg-surface-secondary">
      <VerticalStack gap="800">
        <Text variant="heading2xl" alignment="center" fontWeight="bold">
          CUSTOMER REVIEWS
        </Text>

        {/* Desktop Layout (1440px+) */}
        <Box display={{ xs: 'none', lg: 'block' }}>
          <HorizontalStack gap="600" align="center">
            <button
              onClick={prevReview}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icon source={ChevronLeftIcon} />
            </button>

            <HorizontalStack gap="600">
              {mockReviews.map((review) => (
                <Box key={review.id} width="33.33%">
                  <ReviewCard review={review} />
                </Box>
              ))}
            </HorizontalStack>

            <button
              onClick={nextReview}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icon source={ChevronRightIcon} />
            </button>
          </HorizontalStack>
        </Box>

        {/* Mobile Layout (375px) */}
        <Box display={{ xs: 'block', lg: 'none' }}>
          <VerticalStack gap="400">
            <ReviewCard review={mockReviews[currentIndex]} />

            <HorizontalStack gap="400" align="center">
              <button
                onClick={prevReview}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Icon source={ChevronLeftIcon} />
              </button>

              <HorizontalStack gap="200">
                {mockReviews.map((_, index) => (
                  <Box
                    key={index}
                    width="8px"
                    height="8px"
                    borderRadius="round"
                    background={index === currentIndex ? "bg-fill-brand" : "bg-fill-tertiary"}
                  />
                ))}
              </HorizontalStack>

              <button
                onClick={nextReview}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Icon source={ChevronRightIcon} />
              </button>
            </HorizontalStack>
          </VerticalStack>
        </Box>
      </VerticalStack>
    </Box>
  );
};

export default CustomerReviews;