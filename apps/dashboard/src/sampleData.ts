import type { Upstream, ToolTrace } from './types';

export const SAMPLE_UPSTREAMS: Upstream[] = [
  {
    id: 'up_sample_woocommerce',
    slug: 'woocommerce',
    name: 'WooCommerce Storefront',
    url: 'https://store-api.internal.corp/v3/mcp',
    authType: 'bearer',
    authHeaderName: null,
    hasCredential: true,
    enabled: true,
    state: 'connected',
    error: null,
    checkedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    latencyMs: 42,
    skippedTools: [],
    tools: [
      {
        name: 'list_products',
        description: 'Query store catalog with pagination, category filter and SKU lookup.',
        readOnly: true,
      },
      {
        name: 'get_order',
        description: 'Fetch complete order object including line items, shipping status and billing details.',
        readOnly: true,
      },
      {
        name: 'create_product',
        description: 'Publish a new catalog item with pricing, inventory threshold and metadata.',
        readOnly: false,
      },
      {
        name: 'update_inventory',
        description: 'Adjust stock levels and backorder policies for an existing product SKU.',
        readOnly: false,
      },
    ],
  },
  {
    id: 'up_sample_github',
    slug: 'github-ops',
    name: 'GitHub Operations Bridge',
    url: 'https://mcp-gateway.internal.net/github/sse',
    authType: 'header',
    authHeaderName: 'X-GitHub-Token',
    hasCredential: true,
    enabled: true,
    state: 'connected',
    error: null,
    checkedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    latencyMs: 118,
    skippedTools: ['internal__eval_script'],
    tools: [
      {
        name: 'search_code',
        description: 'Execute semantic and pattern search across indexed repository files.',
        readOnly: true,
      },
      {
        name: 'get_pull_request',
        description: 'Retrieve review comments, commit log and CI check run statuses.',
        readOnly: true,
      },
      {
        name: 'create_pull_request',
        description: 'Open a pull request from a feature branch against the default branch.',
        readOnly: false,
      },
    ],
  },
  {
    id: 'up_sample_warehouse',
    slug: 'bi-warehouse',
    name: 'Analytics Warehouse',
    url: 'https://warehouse.data.corp:8443/mcp',
    authType: 'bearer',
    authHeaderName: null,
    hasCredential: true,
    enabled: true,
    state: 'unreachable',
    error: 'SSL Handshake failure: Upstream certificate expired at 2026-10-25T08:14:00Z. TLS verification rejected the connection.',
    checkedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    latencyMs: null,
    skippedTools: [],
    tools: [],
  },
  {
    id: 'up_sample_filesystem',
    slug: 'sandbox-fs',
    name: 'Sandbox Filesystem',
    url: 'http://127.0.0.1:4040/mcp',
    authType: 'none',
    authHeaderName: null,
    hasCredential: false,
    enabled: false,
    state: 'disabled',
    error: null,
    checkedAt: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
    latencyMs: null,
    skippedTools: [],
    tools: [
      {
        name: 'read_file',
        description: 'Safely read workspace text files up to 64KB.',
        readOnly: true,
      },
      {
        name: 'list_directory',
        description: 'List file names and directory trees within the designated root.',
        readOnly: true,
      },
    ],
  },
];

export const SAMPLE_NOTEBOOK_MESSAGES = [
  {
    role: 'user' as const,
    content: 'Check the status of order #1084 and confirm whether the item was dispatched.',
  },
  {
    role: 'assistant' as const,
    content: 'Order #1084 was confirmed this morning. All line items are packed and the parcel was handed over to the courier (Tracking ID: TRK-98421-US). Delivery is scheduled for tomorrow afternoon.',
    toolCalls: [
      {
        tool: 'woocommerce__get_order',
        arguments: { order_id: 1084, include_shipping: true },
        ok: true,
        durationMs: 44,
        preview: JSON.stringify({
          id: 1084,
          status: 'completed',
          total: '249.00 USD',
          customer: 'm.chen@example.org',
          fulfillment: {
            carrier: 'Priority Parcel',
            tracking: 'TRK-98421-US',
            dispatched_at: '2026-10-25T07:30:00Z',
          },
        }, null, 2),
      },
    ] as ToolTrace[],
  },
];
