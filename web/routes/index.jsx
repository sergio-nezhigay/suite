import { Layout, Page, Card, Text } from '@shopify/polaris';
import { AutoForm, AutoTable } from '@gadgetinc/react/auto/polaris';
import { api } from '../api';

export default function () {
  return (
    <Page title='Messages manager'>
      <Layout>
        <Layout.Section>
          <Card>
            <Text as='h2' variant='headingLg'>
              How to create SMS Templates-
            </Text>
            <Text as='p'>
              To create SMS templates, use placeholders to represent dynamic
              values. Placeholders should be wrapped in double curly braces. For
              example, you can use <strong>{'{{orderNumber}}'}</strong> to
              insert the order number, or <strong>{'{{orderTotal}}'}</strong>{' '}
              for the total amount. Example template: <br />
              <em>
                "Order number: {'{{orderNumber}}'} has a total of{' '}
                {'{{orderTotal}}'} UAH."
              </em>
            </Text>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            {/** AutoForm automatically calls allowedTag.create on form submission */}
            <AutoForm
              action={api.smsTemplates.create}
              title='Add sms templates21'
            />
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text as='h2' variant='headingLg'>
              Manage sms
            </Text>

            <AutoTable
              model={api.smsTemplates}
              columns={['title', 'smsText']}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
