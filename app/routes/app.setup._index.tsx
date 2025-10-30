import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { 
  Page, 
  Layout, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  Banner,
  TextField,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import { setupAutoResize } from '~/util/iframe-helper';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const client = await db.getClient(session.clientId);
  const existingProgram = await db.getClubProgram(session.clientId);
  
  return {
    session,
    client,
    existingProgram,
    isEditMode: !!existingProgram,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const formData = await request.formData();
  const clubName = formData.get('club_name') as string;
  const clubDescription = formData.get('club_description') as string;
  
  if (!clubName) {
    return {
      success: false,
      message: 'Club name is required',
    };
  }
  
  try {
    const existingProgram = await db.getClubProgram(session.clientId);
    
    if (existingProgram) {
      // Update existing
      await db.updateClubProgram(existingProgram.id, clubName, clubDescription);
    } else {
      // Create new
      await db.createClubProgram(session.clientId, clubName, clubDescription);
    }
    
    // Redirect to tiers page
    return {
      success: true,
      redirect: addSessionToUrl('/app/setup/tiers', session.id),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to save club program',
    };
  }
}

export default function SetupIndex() {
  const { client, existingProgram, isEditMode, session } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  const [clubName, setClubName] = useState(
    existingProgram?.name || `${client.org_name} Wine Club`
  );
  const [clubDescription, setClubDescription] = useState(
    existingProgram?.description || 
    'Liberate your wine buying experience. Enjoy member pricing on your schedule - no forced shipments, no surprises.'
  );
  
  useEffect(() => {
    setupAutoResize();
  }, []);
  
  // Handle redirect from action
  useEffect(() => {
    if (actionData?.success && actionData.redirect) {
      navigate(actionData.redirect);
    }
  }, [actionData, navigate]);
  
  return (
    <Page
      title={isEditMode ? "Edit Club Program" : "LiberoVino Club Setup"}
      backAction={{ content: 'Cancel', onAction: () => navigate(addSessionToUrl('/app', session.id)) }}
    >
      <Layout>
        {/* Error Messages */}
        {actionData && !actionData.success && (
          <Layout.Section>
            <Banner tone="critical" title={actionData.message} />
          </Layout.Section>
        )}
        
        {/* Welcome Message */}
        {!isEditMode && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Welcome to LiberoVino! 🍷
                </Text>
                <Text variant="bodyMd" as="p">
                  LiberoVino transforms traditional wine clubs by giving your members complete freedom.
                  No forced shipments, no rigid schedules - just member benefits on their terms.
                </Text>
                <Text variant="bodyMd" as="p">
                  Let's set up your club program in a few simple steps:
                </Text>
                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    ✓ Define your club name and description
                  </Text>
                  <Text variant="bodyMd" as="p">
                    ✓ Create membership tiers with benefits
                  </Text>
                  <Text variant="bodyMd" as="p">
                    ✓ Configure promotions and loyalty rewards
                  </Text>
                  <Text variant="bodyMd" as="p">
                    ✓ Review and launch
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
        
        {/* Club Information Form */}
        <Layout.Section>
          <Form method="post">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h3">
                  Club Information
                </Text>
                
                <TextField
                  label="Club Name"
                  value={clubName}
                  onChange={setClubName}
                  autoComplete="off"
                  helpText="This is how your club will be branded to members (e.g., 'Napa Valley Wine Club')"
                />
                
                <TextField
                  label="Club Description"
                  value={clubDescription}
                  onChange={setClubDescription}
                  multiline={4}
                  autoComplete="off"
                  helpText="Describe what makes your club special and emphasize the freedom LiberoVino provides"
                />
                
                <input type="hidden" name="club_name" value={clubName} />
                <input type="hidden" name="club_description" value={clubDescription} />
                
                <Button
                  variant="primary"
                  submit
                  disabled={!clubName}
                  size="large"
                >
                  Continue to Tiers →
                </Button>
              </BlockStack>
            </Card>
          </Form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

