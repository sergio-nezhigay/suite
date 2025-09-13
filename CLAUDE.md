# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- **Development server**: `npm run dev` or `yarn dev` (runs Shopify app development server)
- **Build**: `npm run build` or `yarn build` (production build using Vite)
- **Gadget development**: `npm run ggt` or `yarn ggt` (runs Gadget development environment)
- **Shopify CLI commands**: `npm run shopify` (access Shopify CLI for deployment, info, etc.)

## Architecture Overview

This is a **Gadget-based Shopify app** that integrates with multiple suppliers and provides e-commerce functionality:

### Core Structure
- **Backend**: `/api/` - Gadget framework-based API with TypeScript
- **Frontend**: `/web/` - React frontend with Polaris UI components
- **Utilities**: `/api/utilities/` - Organized business logic modules

### Key Architectural Components

#### 1. Gadget Framework Integration
- Uses Gadget framework v1.4.0 for backend infrastructure
- Configuration in `settings.gadget.ts` defines Shopify scopes and enabled models
- Models are auto-generated and include Shopify entities (orders, products, customers, etc.)

#### 2. Shopify Integration
- Comprehensive Shopify API integration with extensive scopes
- Handles orders, products, customers, fulfillments, and bulk operations
- Partner app type with customer authentication disabled

#### 3. Multi-Supplier System
Located in `/api/utilities/suppliers/`:
- **Brain**: Electronics supplier with API integration and rate limiting
- **Rozetka**: Ukrainian marketplace with token-based authentication
- **Easy & Schusev**: Additional suppliers with custom integrations
- **Google Sheets**: Supplier data management via Google Sheets API

#### 4. AI-Powered Features
Located in `/api/utilities/ai/`:
- OpenAI integration for product descriptions and embeddings
- Product recommendation system using vector embeddings
- Content generation and parsing capabilities

#### 5. Utility Modules
- **Data processing**: Pagination, text processing, transliteration
- **PDF generation**: Warranty document creation
- **Email utilities**: Warranty email handling
- **HTTP clients**: SMS and Nova Poshta API integrations

### Key Business Logic

#### Token Management
- Singleton pattern for Rozetka API token management (`rozetka/tokenManager.ts`)
- Automatic token refresh with configurable buffer times
- Comprehensive logging and error handling

#### Order Processing
- Multi-stage fulfillment workflow
- Integration with external logistics (Nova Poshta)
- Order status synchronization between platforms

#### Product Management
- Bulk product operations via Shopify Admin API
- Product similarity matching using AI embeddings
- Automated product flagging and categorization

#### Feed Generation
- Dynamic feed generation for marketplace integration
- XML/CSV export capabilities for supplier systems

## Path Aliases

TypeScript path aliases are configured in `tsconfig.json`:
- `utilities` → `api/utilities`
- `routes/*` → `api/routes`
- `types/*` → `api/types`

## Development Notes

- Uses Vite for frontend building with SWC for fast compilation
- Yarn workspaces enabled for extension management
- All Shopify models are auto-synced via Gadget framework
- Environment-specific configurations via Shopify app TOML files
- Token management includes comprehensive debugging utilities for troubleshooting API integrations

## Code Quality Requirements

**IMPORTANT**: After making any code changes, ALWAYS run TypeScript checks to ensure no type errors:
- Run: `npx tsc --noEmit` for full project typecheck
- Run: `npx tsc --noEmit [filename].ts` for specific file typecheck
- Fix all TypeScript errors before considering the task complete