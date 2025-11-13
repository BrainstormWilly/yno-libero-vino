import { jest } from '@jest/globals';

import {
  KLAVIYO_FLOWS,
  KLAVIYO_METRICS,
  MARKETING_METRICS,
  TRANSACTIONAL_METRICS,
} from '~/lib/communication/klaviyo.constants';
import type {
  KlaviyoFlowSeedResult,
  KlaviyoMetricSeedResult,
  KlaviyoTemplateSeedResult,
} from '~/types/communication-klaviyo';
import { seedKlaviyoResources } from '~/lib/communication/klaviyo-seeding.server';

const ensureMetricMock = jest.fn<
  (metricName: string) => Promise<KlaviyoMetricSeedResult>
>();
const ensureTemplateMock = jest.fn<
  ({ name }: { name: string }) => Promise<KlaviyoTemplateSeedResult>
>();
const ensureFlowMock = jest.fn<
  ({ name }: { name: string }) => Promise<KlaviyoFlowSeedResult>
>();

jest.mock('~/lib/communication/providers/klaviyo.server', () => {
  return {
    KlaviyoProvider: jest.fn().mockImplementation(() => ({
      ensureMetric: ensureMetricMock,
      ensureTemplate: ensureTemplateMock,
      ensureFlow: ensureFlowMock,
    })),
  };
});

const metricResponse = (name: string): KlaviyoMetricSeedResult => ({
  id: `${name}/metric`,
  name,
  createdAt: null,
  seededAt: '2025-11-12T00:00:00.000Z',
});

const templateResponse = (name: string): KlaviyoTemplateSeedResult => ({
  id: `${name}/template`,
  name,
  subject: name,
  editorType: 'HTML',
  createdAt: null,
  updatedAt: null,
  seededAt: '2025-11-12T00:00:00.000Z',
});

const flowResponse = (name: string): KlaviyoFlowSeedResult => ({
  id: `${name}/flow`,
  name,
  status: 'draft',
  channel: 'email',
  messageId: `${name}/message`,
  templateId: `${name}/template`,
  metricId: `${name}/metric`,
  createdAt: null,
  updatedAt: null,
  seededAt: '2025-11-12T00:00:00.000Z',
});

describe('seedKlaviyoResources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureMetricMock.mockImplementation(async (metricName: string) =>
      metricResponse(metricName)
    );
    ensureTemplateMock.mockImplementation(async ({ name }: { name: string }) =>
      templateResponse(name)
    );
    ensureFlowMock.mockImplementation(async ({ name }: { name: string }) =>
      flowResponse(name)
    );
  });

  it('seeds transactional metrics, templates, and flows by default', async () => {
    const result = await seedKlaviyoResources({
      apiKey: 'pk_test',
      fromEmail: 'vino@example.com',
      fromName: 'LiberoVino',
    });

    expect(Object.keys(result.metrics ?? {})).toHaveLength(TRANSACTIONAL_METRICS.length);
    expect(Object.keys(result.templates ?? {})).toHaveLength(TRANSACTIONAL_METRICS.length);
    expect(Object.keys(result.flows ?? {})).toHaveLength(TRANSACTIONAL_METRICS.length);

    for (const metricKey of TRANSACTIONAL_METRICS) {
      const metricName = KLAVIYO_METRICS[metricKey];
      expect(ensureMetricMock).toHaveBeenCalledWith(metricName);

      const flowName = KLAVIYO_FLOWS[metricKey];
      expect(ensureFlowMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: flowName,
        })
      );
    }

    expect(result.includeMarketing).toBe(false);
  });

  it('includes marketing automations when requested', async () => {
    const result = await seedKlaviyoResources({
      apiKey: 'pk_test',
      fromEmail: 'vino@example.com',
      fromName: 'LiberoVino',
      includeMarketing: true,
    });

    const expectedLength =
      TRANSACTIONAL_METRICS.length + MARKETING_METRICS.length;
    expect(Object.keys(result.metrics ?? {})).toHaveLength(expectedLength);
    expect(result.includeMarketing).toBe(true);

    for (const metricKey of MARKETING_METRICS) {
      const metricName = KLAVIYO_METRICS[metricKey];
      expect(ensureMetricMock).toHaveBeenCalledWith(metricName);
    }
  });
});
