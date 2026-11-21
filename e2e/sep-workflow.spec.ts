import { expect, test } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Security Engineering Platform core workflows', () => {
  test('sign in, inspect rule, run conversion, and enforce peer deployment approval', async ({ page }) => {
    await page.goto(`${BASE_URL}/?autostart=1`);
    await expect(page.getByRole('heading', { name: 'Detection Engineering Dashboard' })).toBeVisible();

    // Navigate to workspace coverage
    await page.goto(`${BASE_URL}/ex-181748/coverage`);
    await expect(page.getByText('MITRE ATT&CK Coverage Matrix')).toBeVisible();

    // Navigate to repository rules and inspect a rule
    await page.goto(`${BASE_URL}/ex-181748/detections/rules`);
    await expect(page.getByText('Suspicious Encoded PowerShell')).toBeVisible();

    // Run dialect conversion
    await page.goto(`${BASE_URL}/ex-181748/conversions`);
    await page.getByRole('button', { name: 'Convert', exact: true }).click();
    await expect(page.getByText(/Field Mappings Applied|Method:/)).toBeVisible({ timeout: 10000 });

    // Check pending deployment and verify self-approval blocks owner (403)
    await page.goto(`${BASE_URL}/ex-181748/deployments`);
    await page.getByText('Suspicious Encoded PowerShell').first().click();
    await page.getByRole('button', { name: /Approve & Queue/i }).click();
    await expect(page.getByRole('alert')).toContainText(/APPROVAL_NOT_ALLOWED|403|Self-approval/i);

    // Switch sandbox identity to peer approver and approve
    await page.getByRole('button', { name: 'User account menu' }).click();
    await page.getByRole('button', { name: 'Approver' }).click();
    await page.getByRole('button', { name: /Approve & Queue/i }).click();
    await expect(page.getByText(/QUEUED|RUNNING|SUCCEEDED/)).toBeVisible({ timeout: 10000 });
  });
});
