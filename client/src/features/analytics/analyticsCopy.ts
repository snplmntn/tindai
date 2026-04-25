export type AnalyticsTabKey = 'Overview' | 'Insights' | 'Predictions & AI';

export const analyticsText = {
  headerTitle: 'Ganap sa Tindahan',
  headerSubtitle: 'Tingnan ang benta, mabagal na paninda, at mga dapat i-restock.',
  loading: 'Kinukuha ang galaw ng tindahan...',
  errorTitle: 'Hindi ma-update ngayon',
  emptyStateTitle: 'Wala pang maipapakita',
  emptyStateBody: 'Magdagdag ng unang paninda para makita rito ang benta, stock, at simpleng payo.',
  emptyStateAction: 'Magdagdag ng unang paninda',
  summaryTab: 'Buod',
  watchListTab: 'Bantayan',
  buyListTab: 'Bibilhin',
  summaryBannerLabel: 'Mabilisang tingin ngayon',
  summaryBannerRefreshing: 'Ina-update ang buod',
  summaryBannerTitle: 'Buod',
  summaryBannerFallback: 'Mapupuno ito habang nadadagdagan ang benta.',
  watchListBannerLabel: 'Mga dapat bantayan',
  watchListBannerRefreshing: 'Ina-update ang bantayan',
  watchListBannerTitle: 'Bantayan',
  watchListBannerFallback: 'Magdagdag ng mga 7 araw na benta para makita rito ang galaw ng items.',
  buyListLabel: 'Gabay sa restock',
  buyListTitle: 'Mga susunod na bibilhin',
  buyListFallback: 'Lalabas ito pag may ilang araw nang benta.',
  buyListAiTone: 'Batay sa AI at benta',
  buyListRefreshingTone: 'Ina-update mula sa phone',
  buyListLocalTone: 'Batay sa tala sa phone',
  salesToday: 'Benta Ngayon',
  itemsSoldToday: 'Nabenta Ngayon',
  salesOverTime: 'Takbo ng Benta',
  bestSellers: 'Pinakamabenta',
  runningLow: 'Malapit Maubos',
  utangBalance: 'Kabuuang Utang',
  watchItemsSold: 'Mga Nagbago',
  watchItemsSoldCaption: 'Items na nagbago ngayong linggo',
  sellingFast: 'Mabilis Mabenta',
  sellingSlow: 'Mabagal Mabenta',
  changesThisWeek: 'Nagbago Ngayong Linggo',
  nextBuyList: 'Listahan ng Bibilhin',
  mayRunOutSoon: 'Maaaring Maubos',
  simpleAdvice: 'Simpleng Payo',
  last7Days: 'Huling 7 Araw',
  seeAll: 'Tingnan Lahat',
  noLowStock: 'Wala pang malapit maubos ngayon.',
  noFastItems: 'Wala pang mabilis mabenta.',
  noSlowItems: 'Wala pang mabagal mabenta.',
  noChanges: 'Wala pang malaking pagbabago.',
  noPredictions: 'Wala pang posibleng maubos agad.',
  noAdvice: 'Wala pang payo.',
  enoughStock(days: number) {
    return `Mukhang sapat ang stock mo para sa susunod na ${days} araw.`;
  },
  buyAgain(quantity: number, unit: string) {
    return `Bumili ng ${quantity} ${unit}`;
  },
} as const;

const analyticsTabLabels: Record<AnalyticsTabKey, string> = {
  Overview: analyticsText.summaryTab,
  Insights: analyticsText.watchListTab,
  'Predictions & AI': analyticsText.buyListTab,
};

export function getAnalyticsTabLabel(tab: AnalyticsTabKey) {
  return analyticsTabLabels[tab];
}
