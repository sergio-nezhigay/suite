import {
  AppType,
  Provider as GadgetProvider,
  useGadget,
} from '@gadgetinc/react-shopify-app-bridge';
import { NavMenu } from '@shopify/app-bridge-react';
import { Box, Card, Page, Spinner, Text } from '@shopify/polaris';
import { useEffect } from 'react';
import {
  Link,
  Outlet,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { api } from '../api';
import Feeds from '../routes/feeds';

//import FileUploadPage from '../routes/upload';
import Index from '../routes/index';
import Test from '../routes/test';
import Tagger from '../routes/tagger';
import Supplier from '../routes/supplier.$name';

function Error404() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const appURL = process.env.GADGET_PUBLIC_SHOPIFY_APP_URL;

    if (appURL && location.pathname === new URL(appURL).pathname) {
      navigate('/', { replace: true });
    }
  }, [location.pathname]);

  return <div>404 not found</div>;
}

function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path='/' element={<Layout />}>
        <Route index element={<Index />} />
        <Route path='/feeds' element={<Feeds />} />
        <Route path='/test' element={<Test />} />
        <Route path='/tagger' element={<Tagger />} />
        <Route path='/supplier/:supplierId' element={<Supplier />} />
        {/*<Route path='/upload' element={<FileUploadPage />} />*/}
        <Route path='*' element={<Error404 />} />
      </Route>
    )
  );

  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

function Layout() {
  return (
    <GadgetProvider
      type={AppType.Embedded}
      shopifyApiKey={window.gadgetConfig.apiKeys.shopify}
      api={api}
    >
      <AuthenticatedApp />
    </GadgetProvider>
  );
}

function AuthenticatedApp() {
  // we use `isAuthenticated` to render pages once the OAuth flow is complete!
  const { isAuthenticated, loading } = useGadget();
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          width: '100%',
        }}
      >
        <Spinner accessibilityLabel='Spinner example' size='large' />
      </div>
    );
  }
  return isAuthenticated ? <EmbeddedApp /> : <UnauthenticatedApp />;
}

function EmbeddedApp() {
  return (
    <>
      <Outlet />
      <NavMenu>
        <Link to='/' rel='home'>
          Shop Information
        </Link>

        <Link to='/supplier/brain'>Brain</Link>
        <Link to='/supplier/easy'>Easy</Link>
        <Link to='/supplier/cherg'>Cherg</Link>
        <Link to='/supplier/schusev'>Schusev</Link>
        <Link to='/feeds'>Feeds</Link>
        {/*<Link to='/upload'>Upload</Link>*/}
        <Link to='/test'>Test</Link>
      </NavMenu>
    </>
  );
}

function UnauthenticatedApp() {
  return (
    <Page>
      <div style={{ height: '80px' }}>
        <Card padding='500'>
          <Text variant='headingLg' as='h1'>
            App must be viewed in the Shopify Admin
          </Text>
          <Box paddingBlockStart='200'>
            <Text variant='bodyLg' as='p'>
              Edit this page:{' '}
              <a
                href={`/edit/${process.env.GADGET_PUBLIC_APP_ENV}/files/web/components/App.jsx`}
              >
                web/components/App.jsx
              </a>
            </Text>
          </Box>
        </Card>
      </div>
    </Page>
  );
}

export default App;
