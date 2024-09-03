import { Layout, Page, Card, Text } from '@shopify/polaris';
import { AutoForm, AutoTable } from '@gadgetinc/react/auto/polaris';
import { api } from '../api';

export default function () {
  // use autocomponents to automatically create a form and table to manage allowedTag records
  return (
    <Page title='Messages manager'>
      <Layout>
        <Layout.Section>
          <Card>
            {/** AutoForm automatically calls allowedTag.create on form submission */}
            <AutoForm
              action={api.smsTemplates.create}
              title='Add sms templates'
            />
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text as='h2' variant='headingLg'>
              Manage sms211
            </Text>
            {/** AutoTable allows you to delete allowedTag records (in bulk!) */}
            <AutoTable model={api.smsTemplates} columns={['title']} />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
