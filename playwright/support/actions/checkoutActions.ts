import { Page, expect } from '@playwright/test'

export function createCheckoutActions(page: Page) {
  return {
    async expectLoaded() {
      await expect(page.getByRole('heading', { name: 'Finalizar Pedido' })).toBeVisible()
    },

    async expectSummaryTotal(price: string) {
      await expect(page.getByTestId('summary-total-price')).toHaveText(price)
    },
  }
}
